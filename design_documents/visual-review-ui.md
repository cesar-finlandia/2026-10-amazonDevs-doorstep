# Visual review — ui

## Round 1 — 7.2/10 (fix)

| rank | severity | area | problem | fix |
| --- | --- | --- | --- | --- |
| 1 | high | hierarchy | The checklist in the 'AGENTManual' card has no typographic hierarchy; every line is identical in size, weight, and color. | Differentiate the list items. For example, treat them as checklist items with a visible state icon (e.g., a checkbox) and apply the subject/support roles from the spec. |
| 2 | medium | colour | The accent color is underutilized, appearing in only two roles. This makes the screen feel more monochrome than the brief intends. | Apply the `--accent` color to more interactive elements, such as the active tab ('Overview') and the main navigation buttons ('RING', 'AGENT'). |
| 3 | medium | spacing | In the 'OPEN CHECKS' card, the text 'to look at' is not aligned with the large numeral '3', making the metric group feel broken. | Vertically center the text 'to look at' against the numeral '3' or align their baselines to create a cohesive metric component. |
| 4 | low | legibility | Supporting text in several places, such as under the 'Hall camera' device, is very small and may be difficult to read. | Increase the font size for all support-role text to ensure it meets the minimum size specified for body copy in the quality rules. |
| 5 | low | consistency | The main navigation buttons ('RING', 'AGENT') have sharp corners, which is inconsistent with the rounded corners used on all other cards and buttons. | Apply the standard `--radius` token to the main navigation buttons to match the rest of the UI's controls. |
| 6 | low | hierarchy | The 'Sample week' and 'Sample week - synthetic' elements are styled as tags but lack a clear hierarchical relationship to the text they describe. | Style these tags using the 'eyebrow' role from the spec (uppercase, tracked out, muted color) to clearly label the subject text. |

Screenshots:

- design_documents\ui-screenshots\home-paper.png
- design_documents\ui-screenshots\incident-selected-paper.png
- design_documents\ui-screenshots\home-390-paper.png
## Round 2 — 6.0/10 (fix)

| rank | severity | area | problem | fix |
| --- | --- | --- | --- | --- |
| 1 | high | other | The product's hero feature, the 3D doorway view, is unavailable, failing to deliver the core conceptual promise of the design brief. | Implement the 3D view. If this is not technically feasible, the design concept must be reworked to treat the flat view as the primary experience. |
| 2 | medium | consistency | The theme toggle ('Paper' / 'Dusk') is located at the top of the left rail, but the brief specifies it should be in the footer of this rail. | Relocate the theme toggle component to the footer of the sticky 'Household' column. |
| 3 | medium | hierarchy | The 'Open an incident' action within the warning card is styled as plain text, lacking the affordance of an interactive control. | Style the 'Open an incident' action as a secondary button to give it appropriate visual weight and clarify its function. |
| 4 | low | state-clarity | The active state for the top-right toggle buttons ('Ring' / 'Agent') is a very light grey fill, which provides weak visual distinction from the inactive state. | Use the `--accent` color for the active button's fill or border to create a clear, high-contrast active state consistent with other selection indicators. |
| 5 | low | spacing | In the 'DEVICES' list, the vertical spacing between a device name and its description line is too tight, causing them to visually merge. | Increase the spacing between the subject and support lines within each list item, using a value from the spacing scale to improve rhythm and legibility. |
| 6 | low | typography | The summary text '3 moments broke the usual rhythm...' in the 'OPEN CHECKS' card lacks a clear typographic role, appearing as an unstructured sentence. | Apply the standard subject/support roles to the text to give it structure within the card's hierarchy. |

Screenshots:

- design_documents\ui-screenshots\home-paper.png
- design_documents\ui-screenshots\incident-selected-paper.png
- design_documents\ui-screenshots\home-390-paper.png
## Round 2 — 7.5/10 (fix)

| rank | severity | area | problem | fix |
| --- | --- | --- | --- | --- |
| 1 | medium | hierarchy | The checklist items under 'Review the week' are styled identically, providing no information about their status, such as which step is current or completed. | Differentiate the current step using `--text` color and a heavier font-weight. Mute completed steps using `--text-muted` and a strikethrough. |
| 2 | medium | state-clarity | The '3D view unavailable' message is presented as simple body text, not as a structured system status callout, which diminishes its importance. | Reformat the message as an inline callout with an icon, a title, and the explanation as body text, per the anatomy defined in the spec. |
| 3 | medium | legibility | Support text in multiple components, such as camera status and warning details, appears smaller than the 18px minimum required for body text. | Ensure all body and support text has a computed font size of at least 18px to meet the accessibility and readability requirements. |
| 4 | low | consistency | The theme toggle is located at the top of the side rail, contradicting the design brief's specific instruction to place it in the footer for this viewport size. | Move the 'Paper'/'Dusk' theme toggle component to the bottom of the sticky left-hand 'Household' column. |
| 5 | low | typography | The lines of text within the 'Running by hand' status banner are styled identically, lacking typographic hierarchy to distinguish their roles. | Apply distinct styles for the status ('Manual done') and the description, for example by using different weights or colors (`--text` vs `--text-muted`). |
| 6 | low | state-clarity | The inactive tabs 'Focus' and 'Walk' in the 'Doorway view' lack visual affordance, appearing as plain text rather than clickable controls. | Style the tabs as a single component group, for example by adding a continuous bottom border that is thicker or colored for the active tab. |

Screenshots:

- design_documents/ui-screenshots/home-paper.png
- design_documents/ui-screenshots/incident-selected-paper.png
- design_documents/ui-screenshots/home-390-paper.png
## Round 3 — 7.2/10 (fix)

| rank | severity | area | problem | fix |
| --- | --- | --- | --- | --- |
| 1 | high | consistency | The theme toggle is shown in the main content area, directly contradicting the brief's specific placement instruction. | Move the 'Paper'/'Dusk' theme toggle to the footer of the sticky left-hand 'Household' column, as specified for this viewport width. |
| 2 | high | typography | Body text appears smaller than the 18px minimum required by the quality rules for legibility on video. | Increase the base font size for body and support text to at least 18px to meet the §13.1 requirement. |
| 3 | medium | state-clarity | The top 'Running by hand' banner contains unstructured text, lacking the required icon, title, and structured detail. | Reformat the banner to use the standard anatomy: an icon, a title (e.g., 'Manual run'), and structured detail lines. |
| 4 | medium | consistency | The 'offline' status is plain text, while 'ONLINE' is a prominent colored chip. The treatments for device status are inconsistent. | Use a status chip for 'offline' state, with an appropriate warning color, to make its visual weight consistent with the 'ONLINE' state. |
| 5 | low | hierarchy | The main page title and its subtitle are too similar in size and weight, weakening the typographic hierarchy. | Decrease the subtitle's font size or weight more significantly to create a clearer subject/support relationship, per the two-axis rule. |
| 6 | low | legibility | The line height in the multi-line warning message is tight, making the text block dense and harder to read. | Increase the line-height on multi-line text blocks to approximately 1.5 to improve readability. |
| 7 | low | spacing | The 'Open the action list' link in the top banner is right-aligned against left-aligned text, creating awkward visual tension. | Align the link to the left with the other banner text, or move it to a more logical home like the right-hand column. |

Screenshots:

- design_documents\ui-screenshots\home-paper.png
- design_documents\ui-screenshots\incident-selected-paper.png
- design_documents\ui-screenshots\home-390-paper.png
## Round 3 — 7.0/10 (fix)

| rank | severity | area | problem | fix |
| --- | --- | --- | --- | --- |
| 1 | high | typography | The warning card's primary text is too large and bold, harming scannability, and the 'Open an incident' action is not styled as a control. | Reduce the main text's size and weight. Style 'Open an incident' as an accent-colored link or button to make it actionable. |
| 2 | medium | consistency | The 'Paper'/'Dusk' theme toggle is located in the header area, but the brief specifies it should be in the footer of the left rail. | Relocate the theme toggle component to the footer of the sticky left-hand 'Household' rail as specified in the design brief. |
| 3 | medium | colour | The selected 'By hand' button uses a solid dark fill, which is inconsistent with the 'ink on paper' material concept. | Restyle the selected button state using the '--accent' color for the fill or a prominent border, avoiding solid dark backgrounds. |
| 4 | low | hierarchy | In the 'DEVICES' list, the device name (e.g., 'Front door') and its type ('Doorbell') have very similar typographic treatment, weakening the hierarchy. | Apply the §2 three-role stack: make the device name the 'subject' and the type/details the 'support' (e.g., smaller and using '--text-muted'). |
| 5 | low | spacing | Vertical spacing between cards in the right-hand column is uniform, reducing the clarity of information groups. | Increase the top margin between major card components like 'APPROVAL' and 'CHECKS' to a larger step from the spacing scale. |

Screenshots:

- design_documents/ui-screenshots/home-paper.png
- design_documents/ui-screenshots/incident-selected-paper.png
- design_documents/ui-screenshots/home-390-paper.png
## Round 1 — 8.2/10 (pass)

| rank | severity | area | problem | fix |
| --- | --- | --- | --- | --- |
| 1 | high | hierarchy | In the 'Review the week' checklist, all items have identical typographic treatment, making the list a monotonous block of text. | Style completed items differently. For example, reduce their opacity or use a lighter text colour (`--text-muted`) to visually separate them from pending items. |
| 2 | medium | typography | The main text in the 'WARNING' card is too large for its container, resulting in awkward line breaks and poor readability. | Reduce the font size of the warning description by one step on the type scale to allow for more comfortable line lengths. |
| 3 | medium | legibility | The text inside the 'WARNING' chip is too small and tightly padded, making it difficult to read. | Increase the font size inside the chip to at least 11px and increase horizontal padding to give the text space. |
| 4 | low | spacing | The subtitle 'Rosa's front door...' is too close to the main title 'The week of 12 October', creating visual tension. | Increase the top margin on the subtitle to add more vertical space, following the spacing scale. |
| 5 | low | hierarchy | The 'Open an incident' link in the warning card uses the same text size as the support text above it, creating ambiguity in its role. | Style the action link distinctly. Consider using the accent color and a slightly smaller font size or different weight. |
| 6 | low | legibility | The 'ONLINE' status indicator text is very small and has low contrast against its green background. | Increase the font size and use a higher contrast text color for the status chip, perhaps a darker shade of green or near-black. |

Screenshots:

- design_documents\ui-screenshots\home-paper.png
- design_documents\ui-screenshots\incident-selected-paper.png
- design_documents\ui-screenshots\home-390-paper.png
## Round 1 — 7.5/10 (fix)

| rank | severity | area | problem | fix |
| --- | --- | --- | --- | --- |
| 1 | high | consistency | The 'Paper' / 'Dusk' theme toggle is located at the top of the main column, but the brief specifies it must be in the footer of the left-hand sticky rail. | Move the theme toggle component to the footer of the leftmost column, as specified in the design brief's 'Placement of the theme toggle' section. |
| 2 | high | material | The primary card surfaces use a background color and shadow but lack the required 1px border, making them appear less like distinct objects. | Add a '1px solid var(--border)' to all card components to satisfy the surface anatomy contract. |
| 3 | medium | hierarchy | In the 'Running by hand' banner, the title line has the same typographic treatment as the detail lines below it, failing to establish it as the subject. | Increase the font weight of the banner's title line ('Running by hand') to subject-weight, differentiating it from the support-role text. |
| 4 | medium | typography | Inside the warning card, the main message and the secondary 'Quiet hours' text have the same font size and weight, differing only in color. | Differentiate the main message and support text on a second axis, for example by increasing the font weight of the main message, to comply with the two-axis rule. |
| 5 | low | hierarchy | In the 'DEVICES' list, the two lines of detail text for the 'Hall camera' ('2 cameras' and '47 min offline') have identical styling. | Apply a different treatment to the '47 min offline' status line to distinguish it from the '2 cameras' count line, for example using a different color or weight. |

Screenshots:

- design_documents\ui-screenshots\home-paper.png
- design_documents\ui-screenshots\incident-selected-paper.png
- design_documents\ui-screenshots\home-390-paper.png
## Round 1 — 8.5/10 (pass)

| rank | severity | area | problem | fix |
| --- | --- | --- | --- | --- |
| 1 | high | hierarchy | All items in the 'Review the week' checklist have identical typographic treatment, making the list difficult to scan. | Use a different text color, like --text-muted, for completed items to visually separate them from pending items. |
| 2 | medium | typography | In the 'DEVICES' list, the device name (subject) and its description (support) have almost identical styling, weakening the hierarchy. | Style the support text ('Doorbell', '2 cameras') using a smaller size and the --text-muted color token, per the canonical stack. |
| 3 | medium | state-clarity | The 'Open an incident' action is styled as plain text, which does not clearly communicate that it is a clickable element. | Restyle 'Open an incident' as an underlined link or a ghost button to afford clickability. |
| 4 | low | legibility | The line-height on the multi-line warning message is tight, making the text block appear dense and slightly harder to read. | Increase the line-height for multi-line body copy to approximately 1.5 to improve readability and visual comfort. |
| 5 | low | consistency | The 'Sample week - synthetic' label is plain text, inconsistent with other status indicators like the 'ONLINE' chip. | Style the label as a chip, perhaps using the `--degraded` token, to create a consistent visual language for statuses. |

Screenshots:

- design_documents\ui-screenshots\home-paper.png
- design_documents\ui-screenshots\incident-selected-paper.png
- design_documents\ui-screenshots\home-390-paper.png
