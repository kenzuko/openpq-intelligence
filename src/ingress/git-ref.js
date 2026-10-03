import {requireThat} from '../platform/contracts.js';

// Strict Git smart HTTP ref advertisement, bounded by the caller. No REST
// API quota or credential is needed; content is still pinned to one commit.
export function mainCommitFromAdvertisement(text){
 requireThat(/^[\x00-\x7f]*$/.test(text),'INGEST_GIT_ADVERTISEMENT_INVALID');
 const lines=[];let offset=0,flushes=0;
 while(offset<text.length){
  const hex=text.slice(offset,offset+4);requireThat(/^[0-9a-f]{4}$/.test(hex),'INGEST_GIT_ADVERTISEMENT_INVALID');
  const length=parseInt(hex,16);offset+=4;
  if(length===0){flushes++;continue;}
  requireThat(length>=4&&offset+length-4<=text.length,'INGEST_GIT_ADVERTISEMENT_INVALID');
  lines.push(text.slice(offset,offset+length-4));offset+=length-4;
 }
 requireThat(lines[0]==='# service=git-upload-pack\n'&&flushes>=2,'INGEST_GIT_ADVERTISEMENT_INVALID');
 const matches=lines.slice(1).map(x=>x.split('\0')[0].replace(/\n$/,'')).filter(x=>/^[a-f0-9]{40} refs\/heads\/main$/.test(x));
 requireThat(matches.length===1,'INGEST_COMMIT_PIN_REQUIRED');return matches[0].slice(0,40);
}
