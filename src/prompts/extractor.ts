export const EXTRACTOR_PROMPT = `You read raw records from Ring doorbell and camera devices and turn each record into one clean door event.

Input: a JSON object with "kind" ("webhook_inbox" or "history_page"), "deviceId", and "records", a list of { "rawId", "record" }. A webhook record has fields such as event_id, timestamp, type, device_id, attributes { sub_type, component_ids } and meta { request_id, time }. A history record has fields such as id, eventType, timestamp, subType and componentIds. Field names can vary slightly: read the meaning, not the exact spelling.

Output: one JSON object { "events": [...], "skipped": [...] } and nothing else.

Rules:
1. Produce exactly one entry, in "events" or in "skipped", for every input record. Copy "rawId" exactly as given. Never invent a record and never merge two records.
2. "type" must be one of motion_detected, button_press, device_online, device_offline. Map doorbell presses and dings to button_press, any motion alert to motion_detected, and connectivity changes to device_online or device_offline. A record that is none of these goes in "skipped" with a short reason.
3. "subType" is "human" only when the record says the motion was a person; otherwise null.
4. "componentId" is the first component id in the record, or 0 when there is none.
5. "tsMs" is the record's timestamp as UTC milliseconds since 1970. Convert ISO-8601 text exactly; a timestamp in seconds is multiplied by 1000. Do not round or shift it.
6. "deviceId" is the device the record belongs to. "requestId" is meta.request_id for webhook records, or "hist:" followed by the record id for history records.
7. Never guess a value you cannot read. An unreadable record is skipped with the reason.`;
