(() => {
  "use strict";

  const $=s=>document.querySelector(s);
  const ENGLISH=(document.documentElement?.lang||"vi").toLowerCase().startsWith("en");
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

  const FALLBACK_AREAS=[
    {id:"all",label:"Toàn đảo"},
    {id:"zone_central_west",label:"Dương Đông",map_query:"Dương Đông, Phú Quốc, Việt Nam"},
    {id:"zone_south",label:"An Thới",map_query:"An Thới, Phú Quốc, Việt Nam"},
    {id:"place_sunset_town",label:"Sunset Town",map_query:"Sunset Town, An Thới, Phú Quốc, Việt Nam"},
    {id:"zone_north",label:"Gành Dầu",map_query:"Gành Dầu, Phú Quốc, Việt Nam"}
  ];
  const QUICK_CATEGORY_IDS=["LOCAL_FOOD","PHARMACY","CLINIC_HOSPITAL","ATM","FUEL","TOILET","LAUNDRY"];
  const QUICK_LABELS={LOCAL_FOOD:"Ăn uống",PHARMACY:"Nhà thuốc",CLINIC_HOSPITAL:"Y tế",ATM:"ATM",FUEL:"Trạm xăng",TOILET:"Nhà vệ sinh",LAUNDRY:"Giặt ủi"};
  const QUICK_SEARCHES={LOCAL_FOOD:"quán ăn",PHARMACY:"nhà thuốc",CLINIC_HOSPITAL:"bệnh viện phòng khám",ATM:"ATM",FUEL:"trạm xăng",TOILET:"nhà vệ sinh công cộng",LAUNDRY:"giặt ủi"};

  const AREA_VIEW={
    all:{center:[10.20,103.97],zoom:10},
    zone_central_west:{center:[10.2172,103.9593],zoom:13},
    zone_south:{center:[10.0191,104.0150],zoom:13},
    place_sunset_town:{center:[10.026903,104.007917],zoom:14},
    zone_north:{center:[10.3759,103.90],zoom:13}
  };

  let support=null;
  let rows=[];
  let selectedArea="all";
  let selectedCategory=null;
  let searchText="";
  let position=null;
  let radiusKm=null;
  let mapOpen=window.matchMedia?.("(min-width: 821px)")?.matches??true;
  let mapLoadPromise=null;
  let dataStatus="loading";
  let debounceTimer=null;
  let nearMap=null;
  let markerLayer=null;
  let userLayer=null;
  let radiusLayer=null;
  const markerById=new Map();

  const initialParams=new URLSearchParams(location.search);
  const requestedArea=initialParams.get("area")||(!initialParams.has("area")?window.OpenPQArea?.get():null);
  const requestedCategory=initialParams.get("category");
  const requestedQuery=initialParams.get("q")||"";

  function category(id=selectedCategory){
    return support?.near_me?.categories?.find(x=>x.id===id)||
      (QUICK_LABELS[id]?{id,label:QUICK_LABELS[id],search_query:QUICK_SEARCHES[id]}:null);
  }

  function hasStoredVenueData(id=selectedCategory){
    if(!id)return false;
    return rows.some(row=>
      (row.entity_type==="venue"||row.entity_type==="utility") &&
      (row.tags||[]).includes(id) &&
      matchesArea(row)
    );
  }

  function isDiscoveryCategory(id=selectedCategory){
    return category(id)?.mode==="directory_search" && !hasStoredVenueData(id);
  }

  function areaQuery(id=selectedArea){
    const fromData=support?.near_me?.manual_areas?.find(x=>x.id===id)?.map_query;
    if(fromData)return fromData;
    return ({
      all:"Phú Quốc, Việt Nam",
      zone_central_west:"Dương Đông, Phú Quốc, Việt Nam",
      zone_south:"An Thới, Phú Quốc, Việt Nam",
      place_sunset_town:"Sunset Town, Phú Quốc, Việt Nam",
      zone_north:"Gành Dầu, Phú Quốc, Việt Nam"
    })[id]||"Phú Quốc, Việt Nam";
  }

  function mapSearchQuery(){
    const cat=category();
    const term=searchText.trim()||cat?.search_query||cat?.label||"địa điểm";
    return [term,areaQuery()].filter(Boolean).join(" ");
  }

  function googleSearchUrl(query){
    return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(query);
  }

  function updateExternalMapLink(query=mapSearchQuery()){
    const link=$("#mapOpenLink");
    if(link)link.href=googleSearchUrl(query);
    const fallbackLink=$("#nearMapFallbackLink");
    if(fallbackLink)fallbackLink.href=googleSearchUrl(query);
  }

  function setMapBadge(text){
    const el=$("#mapDataBadge");
    if(el)el.textContent=text;
  }

  function showMapFallback(query=mapSearchQuery(),message="Bản đồ chưa tải được. Bạn vẫn xem được danh sách địa điểm.") {
    const live=$("#nearLeaflet"),fallback=$("#nearMapFallback");
    if(live)live.hidden=true;
    if(fallback){
      fallback.hidden=false;
      const detail=$("#nearMapFallbackMessage");
      if(detail)detail.textContent=message;
    }
    setMapBadge("Bản đồ tạm thời chưa mở được");
    const note=$("#mapNote");
    if(note)note.textContent="Bạn vẫn có thể dùng danh sách hoặc chủ động tìm thêm bên ngoài.";
    updateExternalMapLink(query);
  }

  function showLiveMap(){
    const live=$("#nearLeaflet"),fallback=$("#nearMapFallback");
    if(fallback)fallback.hidden=true;
    if(live)live.hidden=false;
    if(nearMap)setTimeout(()=>nearMap.invalidateSize(),60);
  }

  function loadLeaflet(){
    if(window.L)return Promise.resolve(true);
    if(mapLoadPromise)return mapLoadPromise;
    mapLoadPromise=new Promise(resolve=>{
      let css=document.querySelector("#nearLeafletCss");
      if(!css){
        css=document.createElement("link");
        css.id="nearLeafletCss";
        css.rel="stylesheet";
        css.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(css);
      }
      const script=document.createElement("script");
      script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async=true;
      script.onload=()=>resolve(!!window.L);
      script.onerror=()=>resolve(false);
      document.head.appendChild(script);
    }).catch(()=>false);
    return mapLoadPromise;
  }

  function initMap(){
    const host=$("#nearLeaflet");
    if(!host||!mapOpen||nearMap)return;
    if(!window.L){
      showMapFallback();
      return;
    }
    nearMap=window.L.map(host,{
      zoomControl:true,
      attributionControl:true,
      preferCanvas:true,
      scrollWheelZoom:false,
      tap:true
    }).setView(AREA_VIEW.all.center,AREA_VIEW.all.zoom);
    if(window.OpenPQMapBase?.add){
      window.OpenPQMapBase.add(nearMap,{maxZoom:19});
    }else{
      window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
        maxZoom:19,attribution:"© OpenStreetMap contributors"
      }).addTo(nearMap);
    }
    markerLayer=window.L.layerGroup().addTo(nearMap);
    userLayer=window.L.layerGroup().addTo(nearMap);
    radiusLayer=window.L.layerGroup().addTo(nearMap);
    setTimeout(()=>nearMap.invalidateSize(),120);
  }

  async function setMapOpen(open){
    mapOpen=!!open;
    const shell=$("#nearMapShell"),button=$("#nearMapToggle");
    if(shell)shell.hidden=!mapOpen;
    if(button){
      button.setAttribute("aria-expanded",String(mapOpen));
      button.textContent=mapOpen?"Ẩn bản đồ":"Xem bản đồ";
    }
    if(!mapOpen)return;
    const loaded=await loadLeaflet();
    if(loaded)initMap();
    else showMapFallback();
    if(support)render();
    if(shell&&window.matchMedia?.("(max-width: 820px)")?.matches){
      shell.scrollIntoView({behavior:"smooth",block:"start"});
      setTimeout(()=>nearMap?.invalidateSize(),170);
    }
  }

  function clearUserLocation(){
    position=null;
    if(userLayer)userLayer.clearLayers();
  }

  function setAreaView(id=selectedArea){
    if(!nearMap||position)return;
    const v=AREA_VIEW[id]||AREA_VIEW.all;
    nearMap.setView(v.center,v.zoom,{animate:true});
  }

  function userIcon(){
    return L.divIcon({className:"near-user-pin",html:"",iconSize:[18,18],iconAnchor:[9,9]});
  }

  function showUserLocation(coords){
    if(!nearMap||!window.L)return;
    showLiveMap();
    userLayer?.clearLayers();
    L.marker([coords.lat,coords.lon],{icon:userIcon(),zIndexOffset:1000})
      .bindPopup("<div class=\"near-popup\"><strong>Vị trí của bạn</strong><small>Chỉ dùng trong phiên này.</small></div>")
      .addTo(userLayer);
    nearMap.setView([coords.lat,coords.lon],15,{animate:true});
  }

  function validPoint(point){
    return point&&Number.isFinite(Number(point.lat))&&Number.isFinite(Number(point.lon))&&
      Number(point.lat)>=9.5&&Number(point.lat)<=10.7&&Number(point.lon)>=103.5&&Number(point.lon)<=104.5;
  }

  function haversine(a,b){
    const geo=window.OpenPQGeo||window.OpenPQGoGeo;
    if(geo?.distanceKm){
      const distance=geo.distanceKm(a,b);
      if(distance!==null)return distance;
    }
    const R=6371,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
    const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
  }

  function nearestArea(pos){
    return Object.entries(AREA_VIEW)
      .filter(([id])=>["zone_central_west","zone_south","zone_north"].includes(id))
      .map(([id,v])=>({id,d:haversine(pos,{lat:v.center[0],lon:v.center[1]})}))
      .sort((a,b)=>a.d-b.d)[0]?.id||"all";
  }

  function buildVenueRows(doc){
    return (doc?.entities||[])
      .map(x=>window.OpenPQVenue?.normalizeVenue(x))
      .filter(Boolean);
  }

  function buildRows(index){
    const utilityMeta=new Map((support?.near_me?.items||[]).map(x=>[x.utility_id,x]));
    return (index?.documents||[]).filter(doc=>!doc.duplicate_of).map(doc=>{
      const meta=doc.entity_type==="utility"?(utilityMeta.get(doc.id)||{}):{};
      return {
        ...doc,
        ...meta,
        id:doc.id,
        name:doc.name,
        address:doc.address||"",
        tags:doc.tags||[],
        route:doc.route||meta.route||null,
        lat:Number.isFinite(doc.map?.lat)?doc.map.lat:null,
        lon:Number.isFinite(doc.map?.lon)?doc.map.lon:null,
        map_precision:doc.map?.precision||null,
        group:doc.group||null,
        utility_type:doc.utility_type||null
      };
    });
  }

  function areaLabel(){
    if(position)return "Vị trí của tôi";
    return manualAreas().find(x=>x.id===selectedArea)?.label||"Toàn đảo";
  }

  function matchesArea(row){
    if(selectedArea==="all")return true;
    if(selectedArea==="place_sunset_town"){
      const hay=[row.name,row.address,...(row.related_entities||[])].join(" ").toLowerCase();
      return row.place_id==="place_sunset_town"||row.id==="place_sunset_town"||hay.includes("sunset town");
    }
    return row.zone_id===selectedArea||row.place_id===selectedArea;
  }

  function matchesCategory(row,id=selectedCategory){
    if(!id)return true;
    if(isDiscoveryCategory(id))return false;
    return (row.tags||[]).includes(id);
  }

  function foldText(value){
    return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase();
  }

  function matchesSearch(row){
    const q=foldText(searchText.trim());
    if(!q)return true;
    const hay=[row.name,row.address,row.what_it_is,row.group,...(row.aliases||[])].join(" ");
    return foldText(hay).includes(q);
  }

  function defaultVisible(row){
    if(selectedCategory||searchText.trim())return true;
    return row.entity_type!=="hotel";
  }

  function manualAreas(){
    return support?.near_me?.manual_areas?.length?support.near_me.manual_areas:FALLBACK_AREAS;
  }

  function radiusCenter(){
    if(position)return position;
    if(selectedArea==="all")return null;
    const view=AREA_VIEW[selectedArea];
    return view?{lat:view.center[0],lon:view.center[1]}:null;
  }

  function renderRadiusControls(){
    const host=$("#radiusRow");
    if(!host)return;
    const center=radiusCenter();
    const values=[null,2,5,10,20];
    host.innerHTML=values.map(value=>{
      const label=value===null?"Toàn khu":value+" km";
      const active=radiusKm===value;
      const disabled=value!==null&&!center;
      return '<button type="button" data-radius="'+(value===null?"all":value)+'" class="'+(active?"active":"")+'" aria-pressed="'+active+'"'+(disabled?" disabled":"")+'>'+label+'</button>';
    }).join("");
    const note=$("#radiusNote");
    if(note)note.textContent=position
      ?"Khoảng cách ước tính, đường đi thực tế có thể dài hơn."
      :center?"Bán kính tính từ trung tâm khu vực bạn chọn, không phải vị trí của bạn.":"Chọn khu vực hoặc dùng vị trí để tìm gần hơn.";
  }

  function renderControls(){
    const areas=manualAreas();
    $("#areaRow").innerHTML=areas.map(x=>
      '<button type="button" data-area="'+esc(x.id)+'" class="'+(x.id===selectedArea?"active":"")+'">'+esc(x.label)+'</button>'
    ).join("");

    const categories=support?.near_me?.categories||[];
    const available=new Set(rows.flatMap(x=>x.tags||[]));
    const cats=categories.filter(x=>available.has(x.id)||x.mode==="directory_search");
    if(selectedCategory&&!cats.some(x=>x.id===selectedCategory)&&!available.has(selectedCategory)&&!QUICK_CATEGORY_IDS.includes(selectedCategory))selectedCategory=null;

    const catById=new Map(categories.map(x=>[x.id,x]));
    const configured=support?.near_me?.priority_categories||support?.near_me?.shortcut_categories;
    const shortcuts=Array.isArray(configured)&&configured.length
      ?configured.map(x=>typeof x==="string"?x:x?.id).filter(id=>QUICK_CATEGORY_IDS.includes(id))
      :QUICK_CATEGORY_IDS;
    const quick=shortcuts.map(id=>catById.get(id)||{id,label:QUICK_LABELS[id]||id});
    $("#quickCategoryRow").innerHTML=quick.map(x=>
      '<button type="button" data-category="'+esc(x.id)+'" class="'+(selectedCategory===x.id?"active":"")+'" aria-pressed="'+(selectedCategory===x.id)+'">'+esc(QUICK_LABELS[x.id]||x.label)+'</button>'
    ).join("")+'<button type="button" data-more-categories aria-expanded="false">Xem thêm</button>';

    $("#categoryRow").innerHTML=
      '<button type="button" data-category="" class="'+(!selectedCategory?"active":"")+'">Tất cả</button>'+
      cats.map(x=>'<button type="button" data-category="'+esc(x.id)+'" class="'+(x.id===selectedCategory?"active":"")+'">'+esc(x.label)+'</button>').join("");
    const more=$("#categoryMore");
    if(more&&selectedCategory&&!shortcuts.includes(selectedCategory))more.open=true;
    renderRadiusControls();
  }

  function glyphFor(row){
    if(row.entity_type==="hotel")return"H";
    const first=(row.tags||[])[0];
    return category(first)?.icon||category(row.utility_type)?.icon||(row.entity_type==="place"?"●":"•");
  }

  function markerColor(item){
    const tags=item.tags||[];
    if(tags.includes("BEACH"))return "#11a7b5";
    if(tags.includes("ENTERTAINMENT")||tags.includes("ACTIVITY"))return "#e77a45";
    if(tags.includes("CULTURE"))return "#8a66b5";
    if(tags.includes("MARKET"))return "#d19a25";
    if(item.entity_type==="hotel")return "#5278a7";
    if(item.entity_type==="utility")return "#4b9b70";
    return "#247d80";
  }

  function markerIcon(item){
    const color=markerColor(item);
    return L.divIcon({
      className:"",
      html:'<div class="near-pin" style="background:'+color+';'+(item.verified===false?'opacity:.65;border:2px dashed #fff;':'')+'"><span>'+esc(glyphFor(item))+'</span></div>',
      iconSize:[30,30],
      iconAnchor:[15,15],
      popupAnchor:[0,-14]
    });
  }

  function openingHoursLabel(item){
    const hours=item.opening_hours;
    const windows=hours?.windows||hours?.times||[];
    const schedule=windows.map(x=>[x.start,x.end].filter(Boolean).join('–')+(x.label?' '+x.label:'')).filter(Boolean).join(' · ');
    if(schedule)return schedule+(ENGLISH?"":(hours?.note?' · '+hours.note:''));
    if(ENGLISH)return item.entity_type==='utility'?'Opening hours have not been confirmed.':'';
    return item.opening_hours_note|| (item.entity_type==='utility'?'Giờ mở cửa chưa được xác nhận.':'');
  }

  function reliabilityLabel(item){
    if(item.verified!==false)return "";
    if(item.utility_type==="CHARGING")return "Điểm sạc do cộng đồng ghi nhận. Chưa xác nhận trạm hoạt động, quyền vào hoặc loại trụ. Hãy kiểm tra ứng dụng VinFast/V-Green trước khi đến.";
    if(item.utility_type==="FUEL")return "Cây xăng tham khảo từ OpenStreetMap, chưa xác nhận còn bán hoặc giờ hoạt động.";
    if(item.utility_type==="PHARMACY")return "Nhà/quầy thuốc do cộng đồng đóng góp; chưa xác nhận giấy phép hiện tại hoặc tình trạng hoạt động.";
    return "Địa điểm do cộng đồng đóng góp; chưa xác nhận còn hoạt động.";
  }
  function mapInfoLabel(item){
    const map=item.map||{};
    const precision=map.precision==="area_anchor"?(ENGLISH?"Area reference pin":"Pin định hướng khu vực"):map.precision==="site_centroid"?(ENGLISH?"Site centroid, may differ from entrance":"Tâm khuôn viên, có thể khác cổng vào"):map.precision?(ENGLISH?"Accuracy: ":"Độ chính xác: ")+map.precision:"";
    const source=map.source&&!/^https?:\/\//i.test(map.source)?(ENGLISH?"Cross-check: ":"Đối chiếu: ")+map.source:"";
    const date=map.verified_at?(ENGLISH?"Last checked: ":"Kiểm tra lần cuối: ")+map.verified_at:"";
    return [precision,source,date,ENGLISH?null:map.note].filter(Boolean).join(" · ");
  }
  function typeLabel(item){
    if(item.entity_type==="venue")return category(item.utility_type)?.label||item.group||"Địa điểm";
    if(item.entity_type==="hotel")return item.star_rating?"Khách sạn "+item.star_rating+" sao":"Khách sạn";
    if(item.entity_type==="activity")return(item.categories||[]).includes("show")?"Show":"Trải nghiệm";
    if(item.entity_type==="place"){
      if(item.tags.includes("BEACH"))return"Bãi biển";
      if(item.tags.includes("ENTERTAINMENT"))return"Vui chơi";
      if(item.tags.includes("MARKET"))return"Chợ";
      if(item.tags.includes("CULTURE"))return"Văn hóa";
      return"Điểm đến";
    }
    return category(item.utility_type)?.label||item.group||"Tiện ích";
  }

  function filteredRows(){
    let visible=rows.filter(defaultVisible).filter(row=>matchesArea(row)).filter(row=>matchesCategory(row)).filter(row=>matchesSearch(row));
    const center=radiusKm!==null?radiusCenter():(position||null);
    const rankByDistance=!!position||radiusKm!==null;
    let gpsFallback=false,radiusCount=null,radiusUnknown=0;

    if(rankByDistance&&validPoint(center)){
      const withCoords=visible.filter(x=>x.verified!==false&&["exact_entrance","site_centroid"].includes(x.map_precision)&&validPoint({lat:x.lat,lon:x.lon}))
        .map(x=>({...x,distance_km:haversine(center,{lat:x.lat,lon:x.lon})}))
        .sort((a,b)=>a.distance_km-b.distance_km);
      const withoutCoords=visible.filter(x=>x.verified===false||!["exact_entrance","site_centroid"].includes(x.map_precision)||!validPoint({lat:x.lat,lon:x.lon}))
        .sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));
      gpsFallback=withoutCoords.length>0;
      if(radiusKm!==null){
        const within=withCoords.filter(x=>x.distance_km<=Number(radiusKm));
        radiusCount=within.length;
        radiusUnknown=withoutCoords.length;
        visible=[...within,...withoutCoords];
      }else visible=[...withCoords,...withoutCoords];
    }else{
      // Near Me prioritizes practical services, not beaches and hotels.
      const priorities=["PHARMACY","CLINIC_HOSPITAL","ATM","FUEL","CHARGING","TOILET","MINIMART"];
      const priority=row=>{
        if(row.entity_type==="utility"){
          const index=priorities.findIndex(id=>(row.tags||[]).includes(id));
          return index>=0?index:priorities.length;
        }
        return row.entity_type==="venue"?20:row.entity_type==="place"?21:row.entity_type==="activity"?22:row.entity_type==="hotel"?23:24;
      };
      visible.sort((a,b)=>priority(a)-priority(b)||
        Number(a.verified===false)-Number(b.verified===false)||
        (b.featured?1:0)-(a.featured?1:0)||
        String(a.name).localeCompare(String(b.name),"vi"));
    }
    return {rows:visible,gpsFallback,radiusCount,radiusUnknown,center};
  }

  function canShowPin(row){
    const precision=row?.map_precision||row?.map?.precision;
    return ["exact_entrance","site_centroid"].includes(precision)&&
      validPoint({lat:row?.lat,lon:row?.lon})&&
      (radiusKm===null||row.verified!==false);
  }
  function renderMapPoints(visible){
    updateExternalMapLink();
    if(!mapOpen)return;
    if(!nearMap){showMapFallback();return;}
    showLiveMap();
    markerLayer?.clearLayers();markerById.clear();
    const mapped=isDiscoveryCategory()?[]:visible.filter(canShowPin);
    const communityCount=mapped.filter(x=>x.verified===false).length;
    for(const x of mapped){
      const marker=L.marker([x.lat,x.lon],{icon:markerIcon(x)});
      marker.bindPopup(
        '<div class="near-popup"><strong>'+esc(x.name)+'</strong>'+
        '<span>'+esc(typeLabel(x))+'</span>'+
        (x.address?'<small>'+esc(x.address)+'</small>':"")+
        (openingHoursLabel(x)?'<small>'+esc(openingHoursLabel(x))+'</small>':"")+
        (reliabilityLabel(x)?'<small>'+esc(reliabilityLabel(x))+'</small>':"")+
        (x.map_precision==="site_centroid"?'<small>Vị trí trong khuôn viên, có thể khác lối vào.</small>':"")+
        (x.phone?'<a href="tel:'+esc(x.phone.replace(/\s/g,""))+'">Gọi '+esc(x.phone)+'</a>':"")+
        '</div>');
      marker.addTo(markerLayer);markerById.set(x.id,marker);
    }
    radiusLayer?.clearLayers();
    const center=radiusKm!==null?radiusCenter():null;
    if(center&&validPoint(center)&&window.L?.circle)
      window.L.circle([Number(center.lat),Number(center.lon)],{radius:Number(radiusKm)*1000,color:"#318d82",fillColor:"#6ac4ae",fillOpacity:.10,weight:2}).addTo(radiusLayer);
    if(position)showUserLocation(position);else setAreaView(selectedArea);
    const missing=Math.max(0,visible.length-mapped.length);
    setMapBadge(mapped.length+" / "+visible.length+" vị trí"+(communityCount?" · "+communityCount+" chưa kiểm chứng":""));
    const note=$("#mapNote");
    if(note)note.textContent=isDiscoveryCategory()
      ?"Chưa có địa điểm đủ rõ vị trí trong danh mục này. Bạn có thể tìm thêm trên Google Maps."
      :missing?missing+" địa điểm chưa rõ vị trí; bạn vẫn xem được trong danh sách."
      :"Bản đồ và danh sách đang dùng cùng bộ lọc.";
  }

  function renderDiscovery(){
    const cat=category(),label=cat?.label||"Địa điểm";
    $("#resultsTitle").textContent=areaLabel()+" · "+label;
    $("#resultsCount").textContent="Chưa có địa điểm phù hợp";
    $("#nearStatus").textContent="Chưa đủ địa điểm để lọc "+label.toLowerCase()+" quanh "+areaLabel()+".";
    renderMapPoints([]);
    $("#nearResults").innerHTML='<article class="discovery-card"><span>TÌM THÊM ĐỊA ĐIỂM</span>'+
      '<strong>Chưa có '+esc(label.toLowerCase())+' phù hợp trong danh sách</strong>'+
      '<p>Nếu cần tìm thêm, bạn có thể mở Google Maps. Kết quả bên ngoài không theo bộ lọc của Open Phu Quoc.</p>'+
      '<a href="'+esc(googleSearchUrl(mapSearchQuery()))+'" target="_blank" rel="noopener noreferrer">Tìm thêm trên Google Maps ↗</a></article>';
  }

  function exactMapQuery(row){
    return [row.name,row.address,"Phú Quốc"].filter(Boolean).join(", ");
  }

  function weatherLocation(row){
    if(!validPoint({lat:row?.lat,lon:row?.lon}))return null;
    const precision=row.map_precision||row.map?.precision;
    if(!["verified_point","site_centroid","area_anchor"].includes(precision))return null;
    return {lat:Number(row.lat),lon:Number(row.lon),precision};
  }

  function weatherSensitive(row){
    const tags=row.tags||[];
    return row.entity_type==="place"||row.entity_type==="activity"||
      tags.some(tag=>["BEACH","ACTIVITY","ENTERTAINMENT"].includes(tag));
  }

  function weatherMessage(item){
    if(!item)return "Chưa có thông tin thời tiết cho điểm này.";
    if(item.status==="OK"&&item.temporal_coverage?.status==="IN_WINDOW_FRAMES"){
      const distances=(item.frames||[]).map(frame=>frame?.native_cell?.distance_from_target_km).filter(Number.isFinite);
      const distance=distances.length?"; ô lưới gần nhất cách "+Math.min(...distances).toFixed(1)+" km":"";
      const cadence=Number.isFinite(item.temporal_coverage?.frame_cadence_hours)
        ?"; nhịp mốc "+item.temporal_coverage.frame_cadence_hours+" giờ":"";
      return "Có "+(item.frames||[]).length+" mốc dự báo"+cadence+distance+". Chưa có đánh giá an toàn tự động; xem trang thời tiết trước khi đi.";
    }
    if(item.temporal_coverage?.status==="BRACKET_ONLY")
      return "Chỉ có mốc trước/sau khoảng xem, hệ thống không nội suy. Hãy kiểm tra trực tiếp trước khi đi.";
    return "Chưa có đủ dự báo cho khoảng thời gian này. Danh sách địa điểm vẫn dùng bình thường.";
  }

  function directoryFallback(){
    const query=mapSearchQuery(),loading=dataStatus==="loading";
    const need=(searchText.trim()||category()?.label||"địa điểm").toLocaleLowerCase("vi");
    $("#resultsTitle").textContent=loading?"Đang tìm địa điểm":areaLabel()+" · Chưa tải được danh sách";
    $("#resultsCount").textContent="";
    $("#nearStatus").textContent=loading?"Đang tải địa điểm quanh "+areaLabel()+".":"Chưa tải được địa điểm. Bạn thử lại sau nhé.";
    $("#nearResults").innerHTML=loading?'<div class="empty">Đang tìm những địa điểm phù hợp...</div>':
      '<article class="discovery-card"><strong>Chưa tải được danh sách '+esc(need)+' lúc này</strong>'+
      '<p>Bạn có thể thử lại hoặc tìm thêm trên Google Maps. Kết quả bên ngoài chưa được Open Phu Quoc lọc.</p>'+
      '<a href="'+esc(googleSearchUrl(query))+'" target="_blank" rel="noopener noreferrer">Tìm thêm trên Google Maps ↗</a></article>';
    if(mapOpen&&!nearMap)showMapFallback(query);
  }

  function render(){
    if(!support||dataStatus==="loading"&&rows.length===0){
      if(dataStatus!=="ready")directoryFallback();
      return;
    }
    if(dataStatus==="unavailable"&&rows.length===0){
      directoryFallback();
      return;
    }
    if(isDiscoveryCategory()){
      renderDiscovery();
      return;
    }

    const result=filteredRows();
    const visible=result.rows;
    window.__openpqNearState={
      ...(window.__openpqNearState||{}),
      rowsCount:rows.length,visibleCount:visible.length,selectedArea,selectedCategory,
      searchText,radiusKm,radiusCount:result.radiusCount,radiusUnknown:result.radiusUnknown,href:location.href,
      activeArea:$("#areaRow .active")?.dataset?.area||null,
      activeCategory:$("#categoryRow .active")?.dataset?.category??null
    };
    const label=selectedCategory?category()?.label:"";
    $("#resultsTitle").textContent=searchText.trim()
      ?"Kết quả cho “"+searchText.trim()+"”"
      :areaLabel()+(label?" · "+label:"");
    $("#resultsCount").textContent=radiusKm!==null&&result.radiusCount!==null
      ?result.radiusCount+" địa điểm trong "+radiusKm+" km"+(result.radiusUnknown?" · "+result.radiusUnknown+" chưa rõ khoảng cách":"")
      :visible.length+" địa điểm";
    $("#nearStatus").textContent=radiusKm!==null&&result.radiusCount!==null
      ?"Đang tìm trong "+radiusKm+" km "+(position?"quanh bạn":"quanh "+areaLabel())+"."+(result.radiusUnknown?" Một số nơi chưa rõ khoảng cách vẫn có trong danh sách.":"")
      :position?"Các địa điểm có vị trí rõ được xếp theo khoảng cách từ bạn."
      :"Đang tìm quanh "+areaLabel()+".";
    renderMapPoints(visible);

    const host=$("#nearResults");
    if(!visible.length){
      const query=googleSearchUrl(mapSearchQuery());
      host.innerHTML='<div class="empty">Chưa thấy kết quả phù hợp. Thử tên khác hoặc bỏ bớt bộ lọc nhé.'+
        (query?' <a href="'+esc(query)+'" target="_blank" rel="noopener noreferrer">Tìm thêm trên Google Maps ↗</a><small> Kết quả bên ngoài không theo bộ lọc đang chọn.</small>':"")+'</div>';
      return;
    }
    const limited=visible.slice(0,120);
    host.innerHTML=limited.map((x,index)=>{
      const distance=Number.isFinite(x.distance_km)
        ?x.distance_km.toFixed(1)+(position?" km đường chim bay":" km từ tâm khu"):"";
      const type=typeLabel(x),query=x.verified===false&&Number.isFinite(x.lat)&&Number.isFinite(x.lon)?x.lat+","+x.lon:exactMapQuery(x);
      const hasPin=canShowPin(x);
      const exactEntrance=hasPin&&x.map_precision==="exact_entrance"&&x.verified!==false;
      const externalHref=exactEntrance
        ?"https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(x.lat+","+x.lon)
        :googleSearchUrl(exactMapQuery(x));
      const address=x.address||"Chưa có địa chỉ đầy đủ";
      const unknownGroup=radiusKm!==null&&result.radiusUnknown&&index===result.radiusCount
        ?'<h3 class="near-unlocated-heading">Chưa xác định khoảng cách · không tính trong vòng '+radiusKm+' km</h3>':"";
      const loc=weatherLocation(x);
      const weatherCta=weatherSensitive(x)&&loc
        ?'<button type="button" data-weather-id="'+esc(x.id)+'">Thời tiết 3 giờ tới</button><small id="weatherStatus_'+encodeURIComponent(x.id)+'" class="near-weather-result" data-weather-status="'+esc(x.id)+'" aria-live="polite"></small>'
        :"";
      return unknownGroup+'<article class="near-card">'+
        '<span>'+esc([type,distance].filter(Boolean).join(" · "))+'</span>'+
        '<strong>'+esc(x.name)+'</strong>'+
        '<p>'+esc(address)+'</p>'+
        (openingHoursLabel(x)?'<small>'+esc(openingHoursLabel(x))+'</small>':"")+
        (reliabilityLabel(x)?'<small>'+esc(reliabilityLabel(x))+'</small>':"")+
        (x.map_precision==="site_centroid"?'<small>Vị trí tham khảo trong khu vực, có thể khác lối vào.</small>':"")+
        (x.source_license==="ODbL-1.0"?'<small><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></small>':"")+
        '<div>'+
          weatherCta+
          (x.phone?'<a href="tel:'+esc(x.phone.replace(/\s/g,""))+'">Gọi →</a>':"")+
          (hasPin?'<button type="button" data-map-id="'+esc(x.id)+'">'+(x.verified===false?"Xem vị trí tham khảo":"Xem trên bản đồ")+'</button>':"")+
          '<a href="'+esc(externalHref)+'" target="_blank" rel="noopener noreferrer">'+(exactEntrance?"Chỉ đường ↗":"Tìm trên Google Maps ↗")+'</a>'+
          (x.external_verify_url?'<a href="'+esc(x.external_verify_url)+'" target="_blank" rel="noopener noreferrer">Kiểm tra nguồn ↗</a>':"")+
          (x.route?'<a href="'+esc(x.route)+'">Thông tin →</a>':"")+
          '<button type="button" class="opq-feedback-trigger" data-openpq-feedback data-feedback-id="'+esc(x.id)+'" data-feedback-name="'+esc(x.name)+'" data-feedback-type="'+esc(["place","activity","venue","hotel","utility"].includes(x.entity_type)?x.entity_type:"general") +'">Góp ý thông tin</button>'+
        '</div></article>';
    }).join("")+(visible.length>limited.length?'<div class="results-more">Còn '+(visible.length-limited.length)+' kết quả. Gõ tên cụ thể để tìm nhanh hơn.</div>':"");
  }

  function bind(){
    $("#areaRow").addEventListener("click",e=>{
      const b=e.target.closest("[data-area]");
      if(!b)return;
      selectedArea=b.dataset.area;
      window.OpenPQArea?.set(selectedArea,"near-manual");
      clearUserLocation();
      if(selectedArea==="all"&&radiusKm!==null)radiusKm=null;
      $("#useLocation").textContent="⌖ Dùng vị trí của tôi";
      renderControls();render();
    });
    $("#quickCategoryRow").addEventListener("click",e=>{
      const more=e.target.closest("[data-more-categories]");
      if(more){
        const details=$("#categoryMore");
        if(details)details.open=true;
        $("#categoryMore summary")?.focus();
        return;
      }
      const button=e.target.closest("[data-category]");
      if(!button)return;
      selectedCategory=button.dataset.category||null;
      renderControls();render();
    });
    $("#categoryRow").addEventListener("click",e=>{
      const b=e.target.closest("[data-category]");
      if(!b)return;
      selectedCategory=b.dataset.category||null;
      renderControls();render();
    });
    $("#radiusRow").addEventListener("click",e=>{
      const b=e.target.closest("[data-radius]");
      if(!b||b.disabled)return;
      radiusKm=b.dataset.radius==="all"?null:Number(b.dataset.radius);
      renderRadiusControls();render();
    });
    $("#nearMapToggle").addEventListener("click",()=>{void setMapOpen(!mapOpen);});
    $("#nearSearch").addEventListener("input",e=>{
      searchText=e.target.value||"";
      clearTimeout(debounceTimer);
      debounceTimer=setTimeout(render,140);
    });
    $("#nearResults").addEventListener("click",async e=>{
      const weatherButton=e.target.closest("[data-weather-id]");
      if(weatherButton){
        const row=rows.find(x=>x.id===weatherButton.dataset.weatherId);
        const point=weatherLocation(row);
        const status=document.getElementById("weatherStatus_"+encodeURIComponent(row?.id||""));
        if(!row||!point)return;
        const client=window.OpenPQWeatherContext;
        if(!client?.requestWindows){
          if(status)status.textContent="Chưa kết nối được nguồn dự báo. Danh sách và đường đi vẫn hoạt động.";
          return;
        }
        weatherButton.disabled=true;
        weatherButton.textContent="Đang kiểm tra...";
        if(status)status.textContent="Đang lấy các mốc dự báo cho địa điểm đã chọn.";
        const from=new Date(),to=new Date(from.getTime()+3*60*60*1000);
        try{
          const payload=await client.requestWindows([{
            entity_id:row.id,activity_scope:"outdoor",location:point,
            window:{from:from.toISOString(),to:to.toISOString()}
          }],{timeoutMs:11500});
          const item=payload.items.find(x=>x.entity_id===row.id);
          if(status)status.textContent=weatherMessage(item);
        }catch{
          if(status)status.textContent="Chưa lấy được dự báo. Danh sách, tìm kiếm và đường đi vẫn hoạt động.";
        }finally{
          weatherButton.disabled=false;
          weatherButton.textContent="Thời tiết 3 giờ tới";
        }
        return;
      }

      const pin=e.target.closest("[data-map-id]");
      if(pin){
        const id=pin.dataset.mapId;
        await setMapOpen(true);
        const marker=markerById.get(id);
        if(marker){
          const p=marker.getLatLng();
          nearMap.setView(p,16,{animate:true});marker.openPopup();
        }else{
          const row=rows.find(item=>item.id===id);
          if(row)showMapFallback(exactMapQuery(row),"Bản đồ chưa tải được. Bạn có thể tìm thêm trên Google Maps.");
        }
        $("#nearMap")?.scrollIntoView({behavior:"smooth",block:"center"});
        return;
      }
      const queryButton=e.target.closest("[data-map-query]");
      if(queryButton){
        await setMapOpen(true);
        showMapFallback(queryButton.dataset.mapQuery||mapSearchQuery(),"Địa điểm chưa có vị trí rõ. Bạn có thể tìm thêm trên Google Maps.");
        $("#nearMap")?.scrollIntoView({behavior:"smooth",block:"center"});
      }
    });
    $("#useLocation").addEventListener("click",()=>{
      const button=$("#useLocation");
      if(!navigator.geolocation){
        $("#nearStatus").textContent="Thiết bị này không chia sẻ được vị trí. Hãy chọn khu vực.";
        return;
      }
      button.disabled=true;button.textContent="Đang lấy vị trí...";
      navigator.geolocation.getCurrentPosition(p=>{
        position={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy};
        const coarse=window.OpenPQArea?.nearest?.(position.lat,position.lon);
        if(!coarse||!validPoint(position)){
          position=null;button.disabled=false;
          $("#nearStatus").textContent="Vị trí ngoài Phú Quốc. Chọn khu vực thủ công nhé.";
          return;
        }
        selectedArea=nearestArea(position);
        window.OpenPQArea?.set(coarse,"near-gps-coarse");
        button.disabled=false;button.textContent="✓ Đang dùng vị trí này";
        renderControls();render();
      },()=>{
        button.disabled=false;button.textContent="⌖ Dùng vị trí của tôi";
        clearUserLocation();
        $("#nearStatus").textContent="Chưa lấy được vị trí. Bạn vẫn có thể tìm bằng tên hoặc chọn khu vực.";
      },{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
    });
  }

  async function load(){
    const readJson=path=>fetch(path,{cache:"default"}).then(response=>{
      if(!response.ok)throw new Error(path+" HTTP "+response.status);
      return response.json();
    });
    const [supportResult,indexResult,venueResult]=await Promise.allSettled([
      readJson("../data/home-support.json"),
      readJson("../data/views/location-index.json"),
      readJson("../data/entities/destination-venues.json")
    ]);
    support=supportResult.status==="fulfilled"?supportResult.value:{near_me:{categories:[],manual_areas:FALLBACK_AREAS}};
    const locationIndex=indexResult.status==="fulfilled"?indexResult.value:{documents:[]};
    const venueDirectory=venueResult.status==="fulfilled"?venueResult.value:{entities:[]};
    const indexRows=buildRows(locationIndex),venueRows=buildVenueRows(venueDirectory);
    rows=window.OpenPQVenue?.mergeWithCanonical
      ?window.OpenPQVenue.mergeWithCanonical(indexRows,venueRows):[...indexRows,...venueRows];
    dataStatus=indexResult.status==="fulfilled"?"ready":"unavailable";

    window.__openpqNearState={
      indexCount:Array.isArray(locationIndex?.documents)?locationIndex.documents.length:0,
      venueCount:Array.isArray(venueDirectory?.entities)?venueDirectory.entities.filter(x=>x.status==="ACTIVE").length:0,
      rowsCount:rows.length,requestedArea,requestedCategory,requestedQuery,
      dataStatus,selectedArea,selectedCategory,searchText
    };
    const validAreas=new Set(manualAreas().map(x=>x.id));
    const validCategories=new Set([
      ...(support.near_me?.categories||[]).map(x=>x.id),
      ...rows.flatMap(row=>row.tags||[]),
      ...QUICK_CATEGORY_IDS
    ]);
    if(requestedArea&&validAreas.has(requestedArea)){
      selectedArea=requestedArea;
      if(initialParams.has("area"))window.OpenPQArea?.set(selectedArea,"near-link");
    }
    if(requestedCategory&&validCategories.has(requestedCategory))selectedCategory=requestedCategory;
    if(requestedQuery){searchText=requestedQuery;$("#nearSearch").value=requestedQuery;}
    renderControls();render();
    if(mapOpen)await setMapOpen(true);
  }

  bind();
  load().catch(error=>{
    console.warn(error);
    support=support||{near_me:{categories:[],manual_areas:FALLBACK_AREAS}};
    dataStatus="unavailable";
    renderControls();
    render();
  });
})();