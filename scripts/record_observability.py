#!/usr/bin/env python3
import hashlib, json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
now = datetime.now(timezone.utc)
source = ROOT / "public" / "data" / "calendar-items.json"
report = ROOT / "public" / "data" / "data-integrity-report.json"
items = json.loads(source.read_text(encoding="utf-8"))
quality = json.loads(report.read_text(encoding="utf-8")) if report.exists() else {}
if not isinstance(items, list) or not items:
    raise RuntimeError("culture calendar has no records")
payload = {"schema":"lets_observability_v1","run_id":f"culture-{now.strftime('%Y%m%dT%H%M%SZ')}","observed_at":now.isoformat(),"service_id":"culture","source":"persisted_culture_calendar","stages":{"collect":{"status":"success","ok":len(items),"artifact":True},"analyze":{"status":"not_started","ok":None},"quality":{"status":"success" if quality.get('status') in {'ok','success'} else 'degraded',"quality_issue_count":quality.get('blockingIssueCount')},"publish":{"status":"success","artifact":True}},"counts":{"records":len(items)},"artifacts":{"calendar":hashlib.sha256(source.read_bytes()).hexdigest()},"note":"Persisted CultureFlow calendar snapshot."}
out=ROOT/"public"/"data"/"observability"/"latest.json"
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"Culture records observed: {len(items)}")
