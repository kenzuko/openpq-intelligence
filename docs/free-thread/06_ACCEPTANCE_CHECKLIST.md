# Checklist nhận lại kết quả luồng free

- [ ] Đúng task, repo/branch/SHA/time được record; latest main re-check trước write.
- [ ] Có changed-file list và không vượt task scope/parallel ownership.
- [ ] Fixtures synthetic rõ, không raw/private source hoặc secret; current operational status không bị suy diễn.
- [ ] Expected kết quả được giải thích độc lập; không sửa case cũ hoặc expected để che bug.
- [ ] Test/report có exact command/result; thiếu execution ghi NOT_RUN.
- [ ] Exact ref/time/scope/history/missingness semantics giữ nguyên; không thêm universal source rank/biển threshold.
- [ ] Reference V2.1/evidence snapshots unchanged; checksum verifier pass nếu đã chạy.
- [ ] Nếu implementation bug có failing fixture + counterexample + fix/test hẹp; design amendment riêng nếu cần.
- [ ] Không production/legacy write, không deploy/merge tự tiện; PR draft/patch đủ review.
- [ ] Gate state/caveat đúng: synthetic/local subset không đổi full G1/G2/G3-G5.

Gate owner chỉ merge khi CI trên exact PR head pass và base vẫn phù hợp. Không chạy lại cloud chỉ vì thêm docs/fixtures. Nếu Worker/capability changes mới, phải re-evaluate primitive proof scope và actual isolated cloud evidence.
