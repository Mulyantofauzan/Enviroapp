import { loadSlideInput, type SlideSource } from '../pdf/export';
import { buildSlidePptx } from './slides';

/** Same data and pages as the PDF export, written as an editable PowerPoint file. */
export async function buildPptxReport(o: SlideSource & { build?: typeof buildSlidePptx }): Promise<Blob> {
  return (o.build ?? buildSlidePptx)(await loadSlideInput(o));
}
