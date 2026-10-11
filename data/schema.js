/* ==========================================================================
   schema.js — the shape of every record in the system
   --------------------------------------------------------------------------
   One file defines the fields, the types, the allowed values, the hints shown
   to staff and the rules applied at capture. The form, the validation and the
   stored records are all generated from this. Change it here and the whole
   system follows — which is what "a system the business can adapt" means in
   practice, as opposed to one the business has to work around.

   Written as JavaScript rather than .json so the resource runs by opening a
   file, with no web server and no internet connection.
   ========================================================================== */

window.LHH_SCHEMA =
{
  "schemaVersion": "1.3.0",
  "business": {
    "name": "Lerato's Hardware & Home",
    "tradingAs": "Lerato's Hardware & Home (Pty) Ltd",
    "address": ["Shop 4, Mabopane Highway", "Soshanguve, Pretoria", "0152"],
    "phone": "012 555 0188",
    "email": "accounts@leratohardware.co.za",
    "vatNumber": "4620318875",
    "regNumber": "2017/448120/07",
    "vatRate": 0.15,
    "currency": "ZAR",
    "locale": "en-ZA",
    "informationOfficer": "L. Mokoena (Owner)"
  },
  "_comment": "Every record stored by this system is wrapped in a _meta envelope. That envelope is the whole point of the exercise: a spreadsheet cell holds a value, a record holds a value PLUS the context needed to trust it.",
  "metaEnvelope": {
    "id":              { "type": "string",  "desc": "Permanent unique identifier. Never reused, never renumbered." },
    "type":            { "type": "string",  "desc": "Which collection this record belongs to." },
    "schemaVersion":   { "type": "string",  "desc": "Shape of the record when it was written. Lets old records be read by new code." },
    "createdAt":       { "type": "isodate", "desc": "When the record was first captured." },
    "createdBy":       { "type": "string",  "desc": "Which user captured it." },
    "modifiedAt":      { "type": "isodate", "desc": "When it was last changed." },
    "modifiedBy":      { "type": "string",  "desc": "Who changed it last." },
    "version":         { "type": "integer", "desc": "Increments on every save. Version 1 is the original capture." },
    "source":          { "type": "enum",    "values": ["counter-capture","stock-take","supplier-invoice","import","migration","system"], "desc": "How the data got here. A number typed off a delivery note is not the same as a number typed from memory." },
    "validationStatus":{ "type": "enum",    "values": ["valid","warning","unverified"], "desc": "Outcome of the validation rules at the moment of saving." },
    "validationNotes": { "type": "array",   "desc": "Any warnings the capturer chose to accept." },
    "links":           { "type": "object",  "desc": "IDs of related records. This is what makes reuse possible." }
  },
  "collections": {
    "products": {
      "label": "Products",
      "idPrefix": "PRD",
      "display": "name",
      "fields": {
        "sku":          { "label":"SKU",            "type":"string",  "required":true,  "unique":true, "pattern":"^[A-Z]{3}-[0-9]{4}$", "hint":"Three letters, dash, four digits. E.g. PLB-0142." },
        "name":         { "label":"Product name",   "type":"string",  "required":true,  "minLength":3 },
        "category":     { "label":"Category",       "type":"enum",    "required":true,  "values":["Plumbing","Electrical","Paint & Finishes","Tools","Building Materials","Garden","Hardware & Fasteners","Home & Cleaning"] },
        "unit":         { "label":"Sold per",       "type":"enum",    "required":true,  "values":["each","metre","litre","kg","bag","box","roll"] },
        "costPrice":    { "label":"Cost price (excl. VAT)", "type":"money", "required":true, "min":0 },
        "sellPrice":    { "label":"Selling price (excl. VAT)","type":"money","required":true, "min":0 },
        "vatApplicable":{ "label":"VAT applies",    "type":"boolean", "default":true },
        "stockOnHand":  { "label":"Stock on hand",  "type":"number",  "required":true, "min":0 },
        "reorderLevel": { "label":"Reorder level",  "type":"number",  "required":true, "min":0, "hint":"When stock drops to this number, it is time to order." },
        "supplierId":   { "label":"Main supplier",  "type":"ref",     "required":true, "refs":"suppliers" },
        "barcode":      { "label":"Barcode",        "type":"string",  "required":false },
        "location":     { "label":"Shelf location", "type":"string",  "required":false, "hint":"Aisle and bay, so staff can actually find it." },
        "active":       { "label":"Still stocked",  "type":"boolean", "default":true }
      },
      "rules": [
        { "id":"margin-positive",  "severity":"error",   "desc":"Selling price must be higher than cost price." },
        { "id":"margin-thin",      "severity":"warning", "desc":"Margin under 10% — check this is deliberate." },
        { "id":"reorder-sane",     "severity":"warning", "desc":"Reorder level higher than stock on hand means you are already short." },
        { "id":"sku-unique",       "severity":"error",   "desc":"Two products may not share a SKU." }
      ]
    },
    "customers": {
      "label": "Customers",
      "idPrefix": "CUS",
      "display": "name",
      "fields": {
        "name":         { "label":"Name / business name","type":"string","required":true, "minLength":2 },
        "type":         { "label":"Customer type",  "type":"enum",   "required":true, "values":["Walk-in","Account","Contractor","Business"] },
        "phone":        { "label":"Mobile number",  "type":"phone",  "required":true, "pattern":"^0[6-8][0-9]{8}$", "hint":"South African mobile, 10 digits, e.g. 0821234567." },
        "email":        { "label":"Email",          "type":"email",  "required":false },
        "vatNumber":    { "label":"VAT number",     "type":"string", "required":false, "pattern":"^4[0-9]{9}$", "hint":"Only for VAT-registered businesses. Ten digits starting with 4." },
        "creditTerms":  { "label":"Payment terms",  "type":"enum",   "required":true, "values":["Cash only","7 days","30 days"], "default":"Cash only" },
        "creditLimit":  { "label":"Credit limit",   "type":"money",  "required":false, "min":0 },
        "popiaPurpose": { "label":"Why we hold this","type":"multi", "required":true, "values":["Fulfil the sale","Warranty & returns","Account & credit control","Marketing (SMS/email)"], "hint":"POPIA s.13: you must be able to say why you hold each piece of personal information." },
        "popiaConsentMarketing": { "label":"Consented to marketing","type":"boolean","default":false },
        "popiaConsentDate":      { "label":"Date consent given","type":"date","required":false },
        "popiaRetentionUntil":   { "label":"Delete after","type":"date","required":false, "hint":"POPIA s.14: do not keep personal information longer than you need it." },
        "notes":        { "label":"Notes",          "type":"text",   "required":false, "hint":"Keep this factual. Anything you type here is personal information the customer may ask to see." }
      },
      "rules": [
        { "id":"consent-needs-date","severity":"error",  "desc":"If marketing consent is ticked, the date it was given is required." },
        { "id":"marketing-needs-channel","severity":"error","desc":"Marketing consent without a phone number or email has nothing to send to." },
        { "id":"credit-needs-terms","severity":"error",  "desc":"A credit limit above zero cannot sit on a cash-only account." },
        { "id":"vat-number-format","severity":"error",   "desc":"A VAT number must be ten digits starting with 4." },
        { "id":"retention-set",     "severity":"warning","desc":"No retention date set — POPIA expects you to know when this record should go." },
        { "id":"purpose-required",  "severity":"error",  "desc":"At least one lawful purpose must be recorded." }
      ]
    },
    "suppliers": {
      "label": "Suppliers",
      "idPrefix": "SUP",
      "display": "name",
      "fields": {
        "name":        { "label":"Supplier name", "type":"string", "required":true },
        "contact":     { "label":"Contact person","type":"string", "required":false },
        "phone":       { "label":"Phone",         "type":"phone",  "required":true },
        "email":       { "label":"Email",         "type":"email",  "required":false },
        "leadTimeDays":{ "label":"Lead time (days)","type":"number","required":true, "min":0, "hint":"How long from placing the order to the stock arriving." },
        "minOrder":    { "label":"Minimum order", "type":"money",  "required":false, "min":0 },
        "accountNo":   { "label":"Our account no.","type":"string", "required":false }
      },
      "rules": [
        { "id":"leadtime-sane","severity":"warning","desc":"Lead time over 30 days — confirm before relying on it for reordering." }
      ]
    },
    "sales": {
      "label": "Sales",
      "idPrefix": "SAL",
      "display": "docNumber",
      "fields": {
        "docNumber":    { "label":"Document number","type":"string","required":true,"unique":true },
        "date":         { "label":"Date",           "type":"date",  "required":true, "noFuture":true },
        "customerId":   { "label":"Customer",       "type":"ref",   "required":true, "refs":"customers" },
        "lines":        { "label":"Items",          "type":"lines", "required":true, "minItems":1 },
        "paymentMethod":{ "label":"Paid by",        "type":"enum",  "required":true, "values":["Cash","Card (Yoco)","SnapScan","EFT","On account"] },
        "status":       { "label":"Status",         "type":"enum",  "required":true, "values":["Paid","Unpaid","Partially paid","Credited"], "default":"Paid" },
        "servedBy":     { "label":"Served by",      "type":"string","required":true }
      },
      "rules": [
        { "id":"line-product-exists","severity":"error","desc":"Every line must point to a product that exists. This is the check a spreadsheet cannot do." },
        { "id":"stock-sufficient",   "severity":"warning","desc":"Selling more than the recorded stock on hand." },
        { "id":"no-future-date",     "severity":"error","desc":"A sale cannot be dated in the future." },
        { "id":"account-sale-terms", "severity":"error","desc":"'On account' is only allowed for customers with credit terms." },
        { "id":"below-cost",         "severity":"warning","desc":"Line is being sold below cost price." }
      ]
    },
    "stockMovements": {
      "label": "Stock movements",
      "idPrefix": "MOV",
      "display": "id",
      "fields": {
        "date":      { "label":"Date",     "type":"date",  "required":true },
        "productId": { "label":"Product",  "type":"ref",   "required":true, "refs":"products" },
        "qty":       { "label":"Quantity", "type":"number","required":true, "hint":"Negative for stock going out." },
        "reason":    { "label":"Reason",   "type":"enum",  "required":true, "values":["Sale","Delivery","Stock take adjustment","Damage / write-off","Return","Internal use"] },
        "reference": { "label":"Reference","type":"string","required":false },
        "by":        { "label":"Captured by","type":"string","required":true }
      },
      "rules": [
        { "id":"movement-product-exists","severity":"error","desc":"Movement must reference a real product." },
        { "id":"writeoff-needs-reference","severity":"warning","desc":"A write-off with no reference cannot be audited later." }
      ]
    }
  },
  "users": [
    { "id":"u-lerato",  "name":"Lerato Mokoena", "role":"Owner",        "permissions":["all"] },
    { "id":"u-sipho",   "name":"Sipho Dlamini",  "role":"Counter staff","permissions":["sales","products:read","customers:create"] },
    { "id":"u-anja",    "name":"Anja van Wyk",   "role":"Bookkeeper",   "permissions":["sales","customers","reports"] },
    { "id":"u-thabo",   "name":"Thabo Nkosi",    "role":"Storeman",     "permissions":["stock","products"] }
  ]
}
;
