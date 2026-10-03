# Kiến trúc hiệu lực

Giữ nguyên locked V2.1 và các reviewed F12-F14 mechanisms; F15 chỉ hoàn thiện runner, schema validation và evidence. Không mở lại kiến trúc tổng thể, không tạo framework hoặc authority store mới.

Cano offline dùng raw exact bytes -> normalizer -> deterministic revisions -> explicit correction ledger -> audit -> portable evidence bundle -> independent verifier with external reviewed pin. F15 full runner không là production admission.

Sau checkpoint owner, inventory/scoped real-source compatibility probe chạy local read-only. Real records tách khỏi synthetic fixture artifacts. Source-recorded author không tự là cryptographic identity. Nhập thật cần source trust/policy/history/admission gates và current deployed capability inventory.

/weather, /airport, /transit và public homepage giữ nguyên scope theo legacy constraints. Không remote write hoặc deploy ở completion này.
