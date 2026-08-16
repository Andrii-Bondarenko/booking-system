# TODO — next steps

Current status: all infrastructure + handler logic implemented; type-check clean; `cdk synth`
green. **Never deployed** (no `cdk bootstrap`/`deploy` yet). No automated tests.

Ordered so each step unblocks the next. Check off as we go.

## 4. Deploy everything and check

- [ ] `npx cdk bootstrap` (one-time per account/region).
- [ ] `npx cdk deploy` — grab the API Gateway URL from the output.
- [ ] Subscribe an email to the Notifications SNS topic (console) so emails are actually visible.
- [ ] Re-run the flows from step 3 against the live URL.
- [ ] Watch CloudWatch Logs for each Lambda; check for errors / cold-start times.
- [ ] `npx cdk destroy` when done to avoid charges (buckets auto-empty, tables are DESTROY).

## 5. Recheck the task

- [ ] Re-read the original task description and tick off every student/mentor/admin action.
- [ ] Confirm each listed AWS service is actually used as described.
- [ ] Note any intentional deviations (SNS-not-SES, simplified CSV upload, non-transactional
      writes) and decide if any should be addressed.

---

## Known gaps / possible improvements (backlog)

- [ ] `POST /import/mentors` takes the CSV as the **raw body**, not multipart form-data
      (would need API Gateway binary media types + a multipart parser).
- [ ] Booking create/cancel do **two separate writes** — make atomic with `TransactWriteItems`.
- [ ] Export `downloadUrl` is an `s3://` URI — issue a **presigned HTTPS URL** instead.
- [ ] No real **auth** — identity comes from `x-student-id`. Add a Cognito/JWT authorizer.
- [ ] `GET /mentors` uses **Scan** — add a GSI + Query if the mentor table grows.
- [ ] Add CI (type-check + tests + `cdk synth`) and commit the work (currently unstaged).

Filter via database in query
ScanAll risk of too big array.
List mentors available timeslots why via filter not dirrect queryto database
Check if it is ok that we take csv file as string. Full file? Use Stream import csv from 'csv-parser'; pipe()
Exports also streaming
Check slot id in bookings
