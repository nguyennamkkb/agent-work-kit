# agent-work-kit

Bộ khung giúp coding agent làm việc dài hơi, ngăn nắp và an toàn trong một dự án, dù là **một agent** hay **cả một đội agent**.

Mỗi dự án có **một cái bàn làm việc** (`.desk/`) cho **một nghề** (iOS, designer…). Trên bàn có mục tiêu, việc đang làm, hàng chờ, việc đang đợi người khác, điều cần nhớ, bài học, và các worker đang làm gì. Nhờ vậy agent:

- luôn biết mục tiêu, việc đang làm và việc kế tiếp, kể cả sang phiên mới hay sau khi context bị nén;
- không chệch hướng: mỗi lúc một việc, việc mới phát sinh thì vào hàng chờ;
- tự nhận ra điều gì quan trọng từ cách bạn làm việc với nó;
- khi việc đủ lớn thì tự chia cho nhiều worker (qua [Orca](https://github.com/stablyai/orca)), mỗi worker có worktree riêng, có tester kiểm, và chỉ merge những gì đã được chứng minh là chạy đúng;
- tự cải tiến cách làm việc, nhưng mọi thay đổi về luật đều phải được bạn đồng ý.

**Bạn không phải làm gì thêm.** Cài xong, cứ làm việc với agent như bình thường.

---

## 5 phút cho người mới

**1. Cài** (chỉ cần Node 18 trở lên, không cài thư viện nào khác):

```bash
npx github:nguyennamkkb/agent-work-kit init --ios        # bàn cho iOS developer
npx github:nguyennamkkb/agent-work-kit init --designer   # bàn cho product designer (Figma)
npx github:nguyennamkkb/agent-work-kit init --universal  # bàn cho mọi việc, kể cả lĩnh vực bạn chưa biết
```

**Không biết chọn nghề nào thì chọn `--universal`.** Gói này dành cho mọi loại việc: nghiên cứu, viết, lập kế hoạch, phân tích, học một thứ mới, làm hồ sơ, hay viết code. Agent làm theo các phương pháp làm việc chuyên nghiệp:

| Phương pháp | Agent làm gì cho bạn |
|---|---|
| Định nghĩa "xong" (SMART, Definition of Done) | trước khi làm, nói rõ sẽ có gì, cho ai, với giới hạn nào, và kiểm bằng cách nào |
| Nghiên cứu có nguồn | lĩnh vực lạ thì tìm cách làm chuẩn trước; dữ kiện quan trọng phải có ít nhất 2 nguồn; không bịa số liệu hay trích dẫn |
| Chia việc không chồng chéo, không sót (MECE) | chia thành các bước kiểm được; bước rủi ro nhất làm thử trước |
| Ma trận lựa chọn | khi phải chọn: đưa 2–3 phương án kèm lợi, hại, chi phí, rồi khuyên một phương án và giải thích vì sao |
| Pre-mortem | trước việc khó quay lại (tiền, pháp lý, sức khoẻ, gửi đi, xoá): liệt kê điều có thể hỏng, có bản dự phòng, hỏi bạn trước; nói rõ lúc nào cần chuyên gia có chứng chỉ |
| PDCA, chỉ xong khi có bằng chứng | kiểm từng bước theo tiêu chí, và chỉ báo xong khi đưa ra được bằng chứng |
| Mẫu chuẩn của từng nghề | báo cáo thì kết luận trước (pyramid principle); kế hoạch thì có mốc, người làm, rủi ro; email thì nói rõ cần gì, bối cảnh, bước tiếp theo… |
| Dạy trong lúc làm (BLUF) | trả lời trước rồi mới giải thích; giải thích thuật ngữ mới và ghi nhớ cho bạn; chỉ cho bạn những gì nên tự kiểm |
| Làm bản nhỏ trước | đưa bản nháp hoặc dàn ý sớm để bạn góp ý, rồi mới hoàn thiện |
| After-action review | xong việc thì rút ra một bài học để lần sau làm tốt hơn |

Kit tự nhận ra harness bạn đang dùng (Claude Code, Codex, OpenCode, Pi, Oh My Pi, Cursor). Nếu không thấy harness nào, kit cài cho Claude Code.

**2. Bước tin cậy một lần** (đây là bước bảo mật của chính harness, kit không làm thay được):

| Harness | Việc cần làm |
|---|---|
| Codex | mở Codex trong dự án, chạy `/hooks` và tin cậy hook của agent-work-kit |
| Pi | chọn tin cậy dự án khi Pi hỏi lần đầu |
| các harness khác | không cần gì |

**3. Làm việc như bình thường.** Cứ nói với agent bạn cần gì. Mọi thứ trên bàn tự diễn ra:

| Bạn nói | Bàn tự làm |
|---|---|
| "làm màn hình đăng nhập" | thành việc đang làm, kèm điều kiện "xong" do agent suy ra |
| "gấp", "quan trọng" | việc được nhắc tới lên P0 |
| "để sau", "tuần sau" | vào hàng chờ với mức thấp, không làm ngay |
| "chờ anh A gửi API" | việc chuyển sang **Chờ**, rồi tự quay lại khi có điều kiện |
| "bỏ cái đó đi" | việc bị huỷ, kèm lời của bạn làm lý do; lấy lại được |
| "nhớ: luôn build bằng scheme Lumen-Dev" | được lưu vào bộ nhớ ngay, phiên sau vẫn nhớ |
| "sai rồi, đừng sửa file đó" | thành một bài học; gặp lại lần hai thì agent đề xuất cách sửa tận gốc |
| "ok" (khi agent hỏi một đề xuất) | đề xuất được duyệt, kèm nguyên văn lời bạn |
| "chia việc cho đội làm song song" | agent hỏi bạn đúng một câu, rồi mới mở worker |

**4. Xem bàn bất cứ lúc nào:**
- `.desk/desk.html`: **dashboard điều hành**, mở bằng trình duyệt, tự làm mới mỗi 10 giây (xem mục [Dashboard](#dashboard));
- `.desk/DESK.md`: bản đọc nhanh, có trong git;
- `npx github:nguyennamkkb/agent-work-kit desk`: xem ngay trong terminal.

**5. Yên tâm.** Không có gì mất hẳn: xoá được hoàn tác, việc huỷ vẫn nằm trong archive. Push, merge, xoá worktree, mở worker đều phải hỏi bạn trước. Kit chỉ ghi vào thư mục dự án. Chi tiết ở mục [An toàn](#an-toàn).

---

## Cái bàn hoạt động thế nào

Bàn là một file dữ liệu, `.desk/desk.json`. Agent chỉ thay đổi nó bằng một lệnh, `node .agentkit/desk.mjs <lệnh>`, mỗi lần một dòng. Agent không mở hay tự sửa file. Nhờ vậy:
- mỗi thao tác chỉ tốn khoảng 20 token;
- dữ liệu không bao giờ sai định dạng;
- lần nào cũng có lịch sử và hoàn tác được.

### Vòng đời một việc

```
 inbox ──▶ todo ──▶ doing ──▶ (review) ──▶ done
             ▲  │     │
             │  ▼     ▼
           waiting   dropped (có lý do · undo được) · failed
```

| Trạng thái | Nghĩa |
|---|---|
| `inbox` | ghi nhanh, chưa phân loại (phải sắp xếp trước khi kết thúc phiên) |
| `todo` | trong hàng chờ, sắp theo P0 → P3, rồi theo số lần được nhắc |
| `doing` | đang làm. Agent chính chỉ làm **một** việc; worker có thể chạy song song |
| `waiting` | chờ bạn, chờ một việc khác, chờ bên ngoài hoặc tới một ngày; tự quay lại `todo` khi đủ điều kiện |
| `review` | worker báo xong, agent chính đang kiểm |
| `done` | xong, **luôn kèm bằng chứng** (lệnh kiểm đã chạy, sha của commit) |
| `dropped` · `failed` | huỷ hoặc thất bại, luôn kèm lý do |

### Những gì bàn tự làm, không tốn token của agent

- **Đầu phiên:** hiện mặt bàn gọn, khoảng 100 token, gồm mục tiêu, việc đang làm, việc đang chờ, việc kế, điều cần nhớ.
- **Tự sắp xếp:**
  - việc 5 phiên không ai đụng tới thì tụt một bậc ưu tiên, việc P3 cũ thì bị huỷ (lấy lại được);
  - điều được nhắc từ 3 lần trở lên thì được ghim vào bộ nhớ;
  - việc đang chờ thì tự quay lại khi tới hạn.
- **Đọc câu của bạn:** tự lưu "nhớ…" và lời sửa sai, tự nâng ưu tiên khi bạn nói "gấp". Câu bình thường thì im lặng, tốn 0 token.
- **Trước khi agent dừng:** nhắc một lần nếu hộp vào còn việc, nếu code đã đổi mà bàn chưa ghi, hoặc nếu còn báo cáo của worker chưa kiểm.
- **Việc lớn:** `split` chia thành các việc con chạy theo thứ tự. Việc cha tự xong khi mọi việc con xong.

### Mức ưu tiên được suy ra từ cách bạn làm việc

| | Khi nào |
|---|---|
| P0 | chặn mục tiêu hoặc gây hại ngay; bạn nói gấp/quan trọng, hoặc nhắc 2 lần trong một phiên |
| P1 | đẩy mục tiêu tiến lên; điều bạn yêu cầu trong phiên này |
| P2 | hữu ích nhưng đợi được; "để sau", ý tưởng của agent |
| P3 | có thì tốt |

---

## Dashboard

`.desk/desk.html` là một file duy nhất: không cần server hay mạng, mở thẳng trong trình duyệt. Sáng/tối theo hệ thống, dùng được trên điện thoại. File tự làm mới mỗi 10 giây mà vẫn giữ bộ lọc, tab và vị trí đang xem. Mở ra là trả lời ngay ba câu hỏi:

| Phần | Cho bạn biết |
|---|---|
| **Đèn sức khoẻ** | xanh / vàng / đỏ, kèm lý do (việc thất bại, worker im lặng, câu hỏi chờ quá 30 phút…) |
| **Chỉ số** | đang làm · hàng chờ · đang chờ · chờ kiểm · xong trong 7 ngày (kèm biểu đồ) · cycle time trung vị · tỉ lệ làm lại |
| **Cần bạn** | câu hỏi của worker, báo cáo chờ kiểm, đề xuất chờ duyệt, việc thất bại, việc chờ bạn, hộp vào. Mỗi mục kèm lệnh, bấm một cái là chép |
| **Đội** | mỗi worker một thẻ: vai trò, agent·model, việc, plan, worktree, chạy bao lâu, ghi chú gần nhất, file, lease, sha; cảnh báo **im lặng > 15 phút**, đang hỏi; vai trò nào rảnh |
| **Dòng thời gian** | mỗi vai trò một làn, xem 24 giờ hoặc 7 ngày: ai làm gì, lúc nào, có chạy song song thật không |
| **Plan** | tiến độ theo màu (xong · chờ kiểm · đang làm · đang chờ), trạng thái worktree |
| **Hiệu quả model** | số lần chạy, đang chạy, xong, thất bại, tỉ lệ thành công, cycle time theo từng model, để chỉnh routing |
| **Board** | kanban lọc theo plan, vai trò, agent, có ô tìm kiếm, giới hạn số việc đang làm |
| **Hoạt động** | 60 sự kiện gần nhất: giao việc, hỏi, trả lời, báo xong, lease… |
| **Kiến thức** | bộ nhớ, bài học, đề xuất, lease |

Bấm vào bất kỳ việc nào để xem chi tiết: lịch sử đầy đủ, route, brief, bằng chứng, sha, phụ thuộc, việc con. Các chỉ số được tính sẵn trong kit (có test); trang chỉ hiển thị.

---

## Làm việc theo đội

> Phần này cần [Orca](https://github.com/stablyai/orca) và `git`. Không có Orca thì bàn vẫn chạy đủ cho một agent và subagent của harness.

Agent chọn **tầng rẻ nhất mà vẫn đủ**, và chỉ leo tầng khi có bằng chứng (quá ~3 file, quá ~15 lần gọi công cụ, hoặc build đỏ lần thứ hai):

| Tầng | Ai làm | Ở đâu | Dùng cho |
|---|---|---|---|
| T0 | agent chính | checkout hiện tại | 1–3 file, rõ ràng |
| T1 | subagent của harness | checkout hiện tại | đọc nhiều, khảo sát, review chỉ đọc |
| T2 | một worker Orca | checkout hiện tại hoặc worktree của plan | một module, build nhiều lần, chạy lâu |
| T3 | engineer + tester | worktree riêng của plan | nhiều module, cần cổng test, chạy cạnh plan khác |
| T4 | mỗi plan một lead | mỗi plan một worktree | từ 2 plan trở lên cùng lúc |

**Quy trình cố định:** plan → việc → giao → kiểm → đóng.

1. **Plan:** `desk plan login --goal "…"` tạo file plan gồm quyết định, chữ ký hàm, thứ tự các bước, file của từng bước, tiêu chí xong.
2. **Việc:** mỗi lần giao là một việc trên bàn, ghi rõ file nó sở hữu. Hai việc đang mở không được giữ chung một file.
3. **Giao:** `desk dispatch Q-9`. Lệnh này tự chọn agent và model theo routing, tự viết brief cho worker, mở worker trong worktree của plan và ghi lại mọi thứ. Lần đầu mở worker trong một phiên, **agent phải hỏi bạn trước**, và lệnh từ chối chạy nếu chưa có câu trả lời của bạn.
4. **Không chờ:** giao xong thì agent kết thúc lượt. Orca đánh thức agent khi worker báo cáo; `desk mail` đọc thư và cập nhật bàn.
5. **Kiểm rồi mới tính là xong:** kiểm sha có thật, đọc diff so với plan, rồi mới `done`.
6. **Cổng merge:** `desk gate login` kiểm:
   - mọi việc đã đóng;
   - tester xanh trên HEAD hiện tại;
   - nhánh đã rebase lên main;
   - worktree sạch.

   Chỉ merge khi bạn đã đồng ý merge.

**Mỗi plan một tên, dùng ở bốn nơi:** file `plans/<ngày>-login.md`, worktree `plan-login`, nhánh `plan/login`, và các việc có `--plan login`.

**Các quy tắc giữ đội đúng hướng:**
- **Lease:** tài nguyên độc quyền (ví dụ simulator iOS) chỉ một tester được giữ tại một thời điểm.
- **Triage 4 loại** cho mỗi báo cáo đỏ:
  1. môi trường: chạy lại;
  2. lỗi trong plan: giao cho fixer;
  3. thiếu sót thiết kế: dừng lại, quyết định;
  4. không thuộc plan: ghi nhận.
- **Hai vòng sửa:** sau 2 vòng sửa thất bại, agent leo thang lên model mạnh hơn hoặc tự làm.
- **Tạm dừng có kỷ luật:** `PAUSE`, `RESUME`, `REBASE`, `ABORT`. Worker commit phần dở rồi mới dừng.
- **Giới hạn:** tối đa 3 worker và 3 worktree (đổi được).

**Routing** nằm trong `.desk/team.json`. Ứng viên có dạng `agent[:model][@effort]`, ví dụ `claude:claude-sonnet-5-5@low` hoặc `omp:provider/model@high`. Mặc định được sinh từ các agent CLI có trên máy bạn, dùng model mặc định của từng agent. Lệnh `desk team check --live` kiểm routing với danh sách model thật.

Hướng dẫn đầy đủ cho agent: [`kit/method/docs/team.md`](kit/method/docs/team.md). Trong dự án, file này nằm ở `.agentkit/docs/team.md`.

---

## An toàn

| Nỗi lo | Kit xử lý thế nào |
|---|---|
| Agent xoá nhầm việc | `drop` bắt buộc có lý do và lưu vào archive; `desk undo` lùi được 30 bước |
| Agent tự ý làm việc lớn | push, merge, force, deploy, thêm/bỏ dependency, mở worker đầu tiên: đều phải hỏi bạn. Claude Code còn được cấu hình quyền "ask" cho `git push`, `rm -rf`, `git reset --hard`… |
| Agent tự đổi luật | đổi luật, công cụ hay cấu trúc phải qua đề xuất có bằng chứng, và chỉ được duyệt khi có nguyên văn lời đồng ý của bạn |
| Đội agent tranh nhau sửa file | mỗi file chỉ một việc sở hữu; file của lead (ví dụ `project.pbxproj`) chỉ agent chính được sửa |
| Merge code chưa kiểm | cổng merge đòi tester xanh trên đúng HEAD hiện tại; bỏ plan thì in ra sha để khôi phục |
| Tốn tiền vì worker chạy vô tội vạ | tối đa 3 worker; sau 2 lần thất bại thì dừng giao; chặn model khớp mẫu `deny` (mặc định `*free*`) |
| Kit làm hỏng dự án | kit chỉ ghi trong vùng `agentkit:start/end`, merge JSON chứ không ghi đè; `remove` trả mọi file về đúng từng byte |
| Kit ghi lung tung trên máy | **chỉ ghi vào thư mục dự án**, và tự dọn cache của `npx` sau mỗi lần chạy |
| Dùng lâu thì file phình to | không đổi gì thì không ghi gì; việc hook chỉ đếm số lần nhắc tới thì chỉ ghi `desk.json`; journal tối đa 256 KB; archive chia theo tháng, chỉ lưu bản tóm tắt; đầu phiên tự dọn memory và bài học cũ (lấy lại bằng `restore`) và brief cũ của worker |
| Plugin lỗi làm treo harness | mọi plugin và hook đều "fail open": có lỗi thì harness vẫn chạy bình thường |

---

## Chi phí token

Đo trên dự án demo, ước lượng 4 ký tự ≈ 1 token:

| | Trước (v1) | Bây giờ |
|---|---|---|
| Cập nhật bàn một lần | ~300–500 (đọc rồi sửa file markdown) | **~20–25** (một lệnh, một dòng kết quả) |
| Câu gõ bình thường | ~46 | **0** |
| Câu "nhớ…" hoặc lời sửa sai | agent tự ghi (~400) | hook tự ghi, agent chỉ nhận ~30–50 |
| Mặt bàn đầu phiên | ~83 | ~100 (thêm việc chờ và trạng thái đội) |
| `AGENTS.md` + skill (cố định mỗi phiên) | ~2.950 | ~2.170 (phương pháp ~1.190 + 7 luật nghề ~650 + `AGENTS.md` ~330) |
| Hướng dẫn đội | – | ~2.000, **chỉ đọc khi dùng worker** |

Phần cố định được harness cache lại nên rẻ hơn nhiều sau lần đầu. Phần lớn chi phí trước đây nằm ở các lần cập nhật bàn, và phần đó đã giảm khoảng 95%.

**Đọc ghi file khi dùng lâu dài:**
- Một câu gõ bình thường chỉ ghi tối đa một dòng journal nhỏ, cộng `desk.json` nếu câu đó nhắc tới một mục; mỗi mục chỉ được đếm một lần mỗi ngày.
- Dashboard và `DESK.md` chỉ được vẽ lại khi bàn thật sự thay đổi.
- Sau một năm, `.desk/` vào khoảng 1–2 MB, thay vì hàng chục MB nếu cứ ghi thêm mãi.

---

## Harness được hỗ trợ

Có bốn cơ chế: hiện bàn đầu phiên, đọc câu của bạn, chặn ghi sai, nhắc trước khi dừng. Cả bốn dùng chung một bộ script trong `.agentkit/hooks/`. Mỗi harness nối vào bằng cơ chế native của nó:

| Harness | Cách nối | Skill | Bàn | Đọc câu | Chặn ghi sai | Nhắc khi dừng |
|---|---|---|---|---|---|---|
| Claude Code | hook trong `.claude/settings.json` | `.claude/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| Codex | hook trong `.codex/hooks.json` | `.agents/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| Pi | extension `.pi/extensions/agentkit-desk.js` | `.agents/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| Oh My Pi | extension `.omp/extensions/agentkit-desk.js` | `.agents/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| OpenCode | plugin `.opencode/plugins/agentkit-desk/` | `.agents/skills/desk/` | ✓ | ✓ | ✓ | ✓ |
| Cursor | rule `.cursor/rules/agentkit-desk.mdc` | (chính rule đó) | checklist | – | – | – |

- Mọi harness đều đọc `AGENTS.md`; Claude Code đọc qua dòng `@AGENTS.md` trong `CLAUDE.md`.
- Plugin và extension chỉ dùng thư viện có sẵn của Node, không import gì từ bên ngoài, kể cả SDK của chính harness.
- Worker Orca có thể là bất kỳ agent nào Orca hỗ trợ: claude, codex, omp, pi, opencode, cursor…

---

## Luật: ba lớp, cập nhật theo ID

1. **Phương pháp bàn** (`kit/method/SKILL.md`): giống nhau cho mọi nghề.
2. **Gói nghề** (`kit/profession/<nghề>/rules.md`): mỗi luật có ID, mức ưu tiên, lý do và cách kiểm.

   ```markdown
   ### IOS-001 · P0
   Before reporting done, run the project's build + test command and show the summary.
   - Why: "done" without a green build is the most common false report.
   - Check: test output appears in the session before "done".
   ```

3. **Luật dự án** (`.desk/rules.local.md`): ghi đè (`override`), tắt (`off`) hoặc thêm (`LOCAL-001 · P2`) theo ID. Luật nào cũng phải dẫn một đề xuất đã được duyệt.

Thứ tự ưu tiên: luật dự án > luật nghề > phương pháp bàn.

**Tự cải tiến:**
1. Một bài học gặp từ 2 lần trở lên → agent viết đề xuất (`desk propose …`), gồm bằng chứng, thay đổi cụ thể, chỉ số thành công và cách gỡ.
2. Agent hỏi bạn một câu. Bạn trả lời "ok" → đề xuất được duyệt.
3. Agent áp dụng, rồi commit.

**Cập nhật kit:** chạy `npx github:nguyennamkkb/agent-work-kit update`.
- Kit so từng luật theo ID: luật mới được thêm, luật đổi được áp dụng.
- Luật mà dự án đang ghi đè thì được giữ nguyên. Kit để lại một ghi chú, và agent báo bạn một lần.
- Bàn v1 (các file markdown) được tự chuyển sang `desk.json`; file cũ được giữ trong `.desk/archive/v1/`.

---

## Lệnh

**Cài đặt** (`npx github:nguyennamkkb/agent-work-kit <lệnh>`):

| Lệnh | Việc |
|---|---|
| `init --<nghề>` | dựng bàn, cài luật nghề và hook cho các harness |
| `switch --<nghề>` | đổi nghề, giữ nguyên bàn; cũng dùng để thêm harness (`switch --codex`) |
| `update` | cập nhật kit và luật nghề (so theo ID); chuyển bàn v1 sang v2 |
| `desk <lệnh>` | lệnh bàn (bảng dưới), dành cho người |
| `review` | xem và duyệt đề xuất trong terminal (không bắt buộc; bình thường bạn trả lời ngay trong chat) |
| `doctor` | kiểm tra cài đặt: file của kit, bàn, đội, routing, công cụ của nghề |
| `remove` | gỡ kit, trả file của bạn về đúng như cũ; giữ `.desk/` trừ khi có `--purge-desk` |
| `list` | liệt kê nghề và harness |

**Lệnh bàn** (agent gọi `node .agentkit/desk.mjs <lệnh>`; bạn gọi `npx … desk <lệnh>`):

| Nhóm | Lệnh |
|---|---|
| Xem | `status` · `list [--all]` · `show Q-7` · `log` · `compact` |
| Việc | `add [P0-3] "…" [--done "kiểm chứng"] [--now] [--files a,b] [--deps Q-1] [--plan slug] [--role r]` · `edit Q-7 --prio/--text/--done/--files …` · `start Q-7` · `next "bước kế"` |
| | `wait Q-7 --on user\|Q-3\|"ai" [--until YYYY-MM-DD]` · `resume Q-7` · `done [Q-7] --proof "…"` · `drop Q-7 --why "…"` · `split Q-7 "a" "b"` · `undo` · `restore Q-7` (lấy lại từ archive) |
| Nhớ, học | `remember "…" [--pin]` · `forget M-2 --why` · `lesson "…"` · `propose "…" --change … --why …` · `approve P-001 --quote "…"` |
| Hướng | `goal "đích" "cách biết đã tới"` · `inbox "…"` · `file Q-9 task\|memory\|lesson` |
| Đội | `team [check\|allow\|set]` · `plan slug` · `route vai-trò` · `dispatch Q-9` · `mail` · `reply Q-9 "…"` · `send Q-9 --subject PAUSE` · `sync --apply` · `fleet` · `lease` · `wt status\|open\|park\|close\|drop\|tidy` · `gate slug` |
| Worker | `worker Q-9 status\|ask\|escalate\|inbox\|lease\|done` |

---

## Kit cài gì vào dự án

```
AGENTS.md                         vùng của kit (giữa agentkit:start/end) + phần của bạn bên dưới
CLAUDE.md                         @AGENTS.md (nếu dùng Claude Code)
.agentkit.json                    manifest: version, nghề, luật, hash từng file
.agentkit/desk.mjs                lệnh bàn
.agentkit/hooks/                  hook dùng chung + lõi bàn (store) + đội (team) + dashboard
.agentkit/docs/team.md            hướng dẫn đội (agent chỉ đọc khi dùng worker)
.claude/skills/desk/SKILL.md      skill duy nhất: phương pháp + luật nghề
.claude/settings.json             hook + quyền "ask", được merge, không ghi đè
.agents/skills/desk/SKILL.md      cùng skill, cho Codex, Pi, Oh My Pi, OpenCode
.codex/hooks.json · .pi/extensions/ · .omp/extensions/ · .opencode/plugins/ · .cursor/rules/   (theo harness)
.mcp.json                         Figma MCP (chỉ khi --designer)
.desk/
  desk.json      dữ liệu bàn (commit)          DESK.md       bản để đọc (commit)
  team.json      hồ sơ đội: build, test, routing (commit)
  plans/         plan và brief cho worker       review/       đề xuất P-*, ghi chú cập nhật U-*
  archive/       YYYY-MM.md (để đọc) + YYYY-MM.jsonl (bản tóm tắt)   rules.local.md  luật dự án
  desk.html · .state.json · .journal.jsonl · .undo/   (không commit, đã có trong .desk/.gitignore)
```

**Kit chỉ ghi vào thư mục dự án.**
- Mỗi lệnh chạy qua `npx` xong, kit tự xoá bản sao của chính nó trong `~/.npm/_npx/` và các mục tải về của nó trong cache npm. Muốn giữ lại thì đặt `AGENTKIT_KEEP_CACHE=1`.
- Ngoài dự án chỉ còn những thứ không do kit tạo: log của npm, và bản ghi tin cậy của Codex, Pi.
- Worktree của plan do Orca tạo trong thư mục workspace của Orca, và bị xoá khi plan đóng.

---

## Thêm một nghề

Tạo thư mục `kit/profession/<tên>/` với hai file.

**`profession.json`:**

```json
{
  "name": "backend",
  "title": "Backend",
  "version": "1.0.0",
  "description": "Backend services in Go",
  "checks": [{ "cmd": "go", "required": false, "hint": "install Go" }],
  "team": { "build": "go build ./...", "test": { "command": "go test ./...", "exclusive": "" }, "leadFiles": ["go.mod"] },
  "mcp": {}
}
```

**`rules.md`:** phần mở đầu (Task, Done, gợi ý ưu tiên, điều đáng nhớ), rồi các luật `### BE-001 · P0`, mỗi luật kèm dòng `- Why:` và `- Check:`.

Xong là cờ `--backend` tự có. Mỗi lần sửa luật, tăng `version` để `update` so đúng. Test tự kiểm mọi gói nghề: ID không trùng, luật nào cũng có `Why` và `Check`, skill ghép xong dưới 220 dòng.

---

## Phát triển

```bash
npm test                       # 55 test: engine, bàn, hook, đội (với Orca giả), từng harness, CLI
UPDATE_SNAPSHOTS=1 npm test    # khi cố ý đổi output của adapter
node bin/cli.js init --ios -y --dir /tmp/demo
```

```
bin/cli.js            điểm vào CLI
src/commands/         init, switch, update, desk, review, doctor, remove, list
src/lib/              engine (ghi file, manifest, so luật theo ID, chuyển bàn v1), marker, merge JSON, tự dọn cache
src/adapters/         một adapter cho mỗi harness
kit/method/           SKILL.md, docs/team.md, desk.mjs, hooks/ (_lib, store, team, cli, 5 hook, dashboard), bridge/, desk/ (mẫu)
kit/profession/       gói nghề: ios, designer, universal
test/                 kit, desk, storage, team, harness; fixtures/fake-orca.mjs
```

## Giới hạn hiện tại

- Việc nhận ra lời sửa, việc gấp, "để sau" hay lời đồng ý dựa trên từ khoá (tiếng Việt và tiếng Anh), nên có thể bỏ sót hoặc bắt nhầm. Bắt nhầm thì `undo` hoặc `forget` là xong.
- Mỗi harness đã được kiểm bằng cách nạp đúng file mà kit sinh ra, với API theo hình dạng đã xác minh trên bản cài (Codex 0.171, OpenCode 2.3.2, Pi 1.6.0, omp 18.3.2). Chưa chạy end-to-end với model thật.
- Phần đội được kiểm bằng một Orca giả trong test, và bằng các lệnh chỉ đọc trên Orca 1.4.268 thật. Quy trình đội (worktree theo plan, lease, triage, cổng merge) được viết lại từ orca-orchestrator, vốn đã chạy thật trên Orca 1.4.246. Chế độ T4 phase A (lead tự mở worker con) bị Orca chặn mặc định.
- Cursor không có hook, nên chỉ có checklist.

## Hỏi đáp

**Tôi có phải học các lệnh không?** Không. Agent tự gọi lệnh. Bảng lệnh dành cho lúc bạn muốn tự xem hoặc tự chỉnh.

**Agent hiểu sai ý tôi thì sao?** Nói thẳng với agent: "không, việc đó chưa xong", "bỏ việc kia đi". Lời sửa của bạn thành bài học. Lỡ tay thì `desk undo`.

**Không có Orca thì sao?** Mọi thứ vẫn chạy với một agent, và subagent của harness ở tầng T1. Lệnh đội báo rõ là cần Orca, không làm gì khác.

**Dữ liệu của tôi đi đâu?** Chỉ nằm trong `.desk/` của dự án. Kit không gửi gì ra ngoài, không ghi vào home, không cần tài khoản.

**Gỡ thế nào?** `npx github:nguyennamkkb/agent-work-kit remove`. File của bạn trở về đúng như trước khi cài. Thêm `--purge-desk` nếu muốn xoá cả bàn.

Đặc tả kỹ thuật: [DESK-SPEC.md](DESK-SPEC.md) · Kế hoạch: [PLAN-v2.md](PLAN-v2.md), [PLAN-v2.1.md](PLAN-v2.1.md).
