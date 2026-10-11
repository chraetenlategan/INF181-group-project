// ARCHIVED in 4.90.0 — not loaded by web/index.html, not synced to the share.
//
// NPO "Members' / Directors' Responsibilities and Approval" page (added 4.88.0
// from the 2026 NPO template). Removed from the NPO entity type at the user's
// request: an NPO set no longer carries a responsibilities page. It used to be
// built in DocumentGenerator.js right after the company `page2`, assembled as
// `tag(pageNpoResponsibilities, 'responsibilities')` between the index and the
// auditor's / reviewer's report, and listed first in INDEX_CONFIGS 'npo-audit'
// and 'npo-review' as { label: "Members' Responsibilities and Approval",
// id: 'memberResponsibilities' } (getIndexConfig swapped "Members'" for
// "Directors'" when Step 4's governing body was directors).
//
// To restore: paste the template back into DocumentGenerator.generate() after
// `page2` (every name below is in scope there — npoBodyLower / npoBodyCap are
// still defined there for the auditor's report), add it back to both NPO
// assembly lines, and put the index row back.
//
// The template, verbatim as it stood:

/*
  const pageNpoResponsibilities = `
  <div class="doc-page compact-page">
<div class="page-header">
  ${regLine}
</div>
<h2>${sr(npoBodyCap)}' Responsibilities and Approval</h2>
<br>
<p>The ${sr(npoBodyLower)} are required in terms of the NPO Act, to maintain adequate accounting records and are responsible for the content and integrity of the financial statements and related financial information included in this report. It is their responsibility to ensure that the financial statements fairly present the state of affairs of the entity as at the end of the financial year and the results of its operations and cash flows for the period then ended, in conformity with International Financial Reporting Standards for Small and Medium-sized Entities and the requirements of the NPO Act of South Africa.</p>
<p>The financial statements are prepared in accordance with International Financial Reporting Standards for Small and Medium-sized Entities and the requirements of the NPO Act of South Africa and are based upon appropriate accounting policies consistently applied and supported by reasonable and prudent judgments and estimates.</p>
<p>The ${sr(npoBodyLower)} acknowledge that they are ultimately responsible for the system of internal financial control established by the entity and place considerable emphasis on maintaining a strong control environment. To enable the ${sr(npoBodyLower)} to meet these responsibilities, the board sets standards for internal control aimed at reducing the risk of error or loss in a cost-effective manner. The standards include the proper delegation of responsibilities within a clearly defined framework, effective accounting procedures and adequate segregation of duties to ensure an acceptable level of risk. These controls are monitored throughout the entity and all employees are required to maintain the highest ethical standards in ensuring the entity's business is conducted in a manner that in all reasonable circumstances is above reproach. The focus of risk management in the entity is on identifying, assessing, managing and monitoring all known forms of risk. While operating risk cannot be fully eliminated, the entity endeavours to minimise it by ensuring that appropriate infrastructure, controls, systems and ethical behaviour are applied and managed within predetermined procedures and constraints.</p>
<p>The ${sr(npoBodyLower)} are of the opinion, based on the information and explanations given by management that the system of internal control provides reasonable assurance that the financial records may be relied on for the preparation of the financial statements. However, any system of internal financial control can provide only reasonable, and not absolute, assurance against material misstatement or loss.</p>
<p>The ${sr(npoBodyLower)} have reviewed the cash flow forecast for the year and, in the light of this review and the current financial position, they are satisfied that the entity has access to adequate resources to continue in operational existence for the foreseeable future.</p>
<p>The financial statements set out on pages ${hlPageStart} to ${hlPageEnd}, which have been prepared on the going concern basis, were approved by the board on ${dateApproved} and are signed on its behalf:</p>
<div class="signature-block resp-sig">
  ${sigBlock(sigDirs)}
</div>
<div class="page-number">${pg2}</div>
  </div>`;
*/
