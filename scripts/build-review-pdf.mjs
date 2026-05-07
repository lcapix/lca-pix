import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('review-screens');
const OUT = path.join(SRC, 'LCAPIX-Review.pdf');

// Show: roughly half of the full workflow — the screens that best tell the
// end-to-end story in one sitting.
const SHOWN = [
  { slug: '01-login',          label: 'Sign in' },
  { slug: '02-home-projects',  label: 'Projects home' },
  { slug: '04-project-detail', label: 'Project detail' },
  { slug: '05-new-base-case',  label: 'New base case' },
  { slug: '07-case-tree',      label: 'Case editor — Tree view' },
  { slug: '10-add-component',  label: 'Add component modal' },
  { slug: '11-results',        label: 'Assessment results' },
];

// Not shown but already built — included on the summary page so the reviewer
// knows these screens exist and are wired up.
const BUILT_NOT_SHOWN = [
  { slug: '03-new-project',    label: 'New project form' },
  { slug: '06-new-comp-case',  label: 'New comparative case form' },
  { slug: '08-case-list',      label: 'Case editor — List view' },
  { slug: '09-case-graph',     label: 'Case editor — Graph view' },
];

const UNDER_CONSTRUCTION = [
  { slug: '12-comparisons-list', label: 'Comparisons (list)' },
  { slug: '13-analytics',        label: 'Analytics' },
  { slug: '14-integrations',     label: 'Integrations (admin)' },
  { slug: '15-guide',            label: 'Docs / Guide' },
  { slug: '16-about',            label: 'About' },
];

const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 36 });
doc.pipe(fs.createWriteStream(OUT));

// Cover page.
doc.fontSize(28).fillColor('#0d3b2e').text('LCAPIX v3 — Product Review', { align: 'left' });
doc.moveDown(0.3);
doc.fontSize(14).fillColor('#3d4a45').text('Visual walkthrough of the current build', { align: 'left' });
doc.moveDown(1.2);

doc.fontSize(12).fillColor('#1f2a25').text('What this PDF covers', { underline: true });
doc.moveDown(0.3);
doc.fontSize(11).fillColor('#2a3530').text(
  'Seven screens tell the end-to-end story: sign in, pick a project, add a case, ' +
  'build it out in the tree, drop in a component, and run an assessment. ' +
  'The final page summarizes the rest of the build — screens we have completed ' +
  'but left out of the walkthrough, and screens still under construction.',
  { align: 'left' }
);
doc.moveDown(0.8);
doc.fontSize(10).fillColor('#5a6661').text(`Generated ${new Date().toISOString().slice(0, 10)}  •  Captured at 1440×900 @2x`);

function renderScreen({ slug, label }, tag) {
  const file = path.join(SRC, `${slug}.png`);
  if (!fs.existsSync(file)) return;

  doc.addPage();

  doc.fontSize(10).fillColor('#6a7571').text(tag, 36, 28);
  doc.fontSize(18).fillColor('#0d3b2e').text(label, 36, 44);

  const pageW = doc.page.width - 72;
  const pageH = doc.page.height - 110;
  doc.image(file, 36, 90, { fit: [pageW, pageH], align: 'center', valign: 'top' });
}

for (const s of SHOWN) renderScreen(s, 'WALKTHROUGH');

// Summary page — what's left.
doc.addPage();
doc.fontSize(26).fillColor('#0d3b2e').text("What's left", { align: 'left' });
doc.moveDown(0.4);
doc.fontSize(12).fillColor('#3d4a45').text(
  'The walkthrough covered roughly half of the workflow. Here is the rest.',
  { align: 'left' }
);
doc.moveDown(1.2);

doc.fontSize(14).fillColor('#0d3b2e').text('Completed — not shown in the walkthrough');
doc.moveDown(0.3);
doc.fontSize(11).fillColor('#2a3530');
for (const s of BUILT_NOT_SHOWN) {
  doc.text(`•  ${s.label}`, { indent: 12 });
}
doc.moveDown(1.0);

doc.fontSize(14).fillColor('#0d3b2e').text('Still under construction');
doc.moveDown(0.3);
doc.fontSize(11).fillColor('#2a3530');
for (const s of UNDER_CONSTRUCTION) {
  doc.text(`•  ${s.label}`, { indent: 12 });
}

doc.end();
console.log('PDF written to', OUT);
