import ExcelJS from "exceljs";
import type { Quote, QuoteItem } from "@shared/schema";

const BASE_FONT = { name: "Arial", size: 7 } as const;
const TEAL = "FF007878";
const SECTION_GRAY = "FFD9D9D9";
const LIGHT_GRAY = "FFF2F2F2";
const BORDER_GRAY = "FFB8B8B8";
const ROW_ALT = "FFFBFBFB";
const ROW_WHITE = "FFFFFFFF";
const BLACK = "FF000000";
const WHITE = "FFFFFFFF";

const MONEY = '"$"#,##0.00';

const thinBorder = {
  top: { style: "thin" as const, color: { argb: BORDER_GRAY } },
  left: { style: "thin" as const, color: { argb: BORDER_GRAY } },
  bottom: { style: "thin" as const, color: { argb: BORDER_GRAY } },
  right: { style: "thin" as const, color: { argb: BORDER_GRAY } },
};

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function fill(argb: string): ExcelJS.FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/**
 * Builds the fully-styled Questivity Quote workbook and returns it as a Buffer.
 */
export async function buildQuestivityExcel(
  quote: Quote,
  items: QuoteItem[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Questivity Quote Converter";
  wb.created = new Date();
  const ws = wb.addWorksheet("Quote");

  // ---- Column widths (A–J) ----
  ws.columns = [
    { width: 7 }, // A Item #
    { width: 16 }, // B Part #
    { width: 42 }, // C Description
    { width: 11 }, // D E-Rate Eligibility %
    { width: 6 }, // E Qty
    { width: 12 }, // F List Price
    { width: 14 }, // G Extended List Price
    { width: 13 }, // H Discounted Price
    { width: 10 }, // I Markup %
    { width: 15 }, // J Extended Discounted Price
  ];

  // ---- ROW 1: header ----
  const headers = [
    "Item #",
    "Part #",
    "Description",
    "E-Rate\nEligibility %",
    "Qty",
    "List Price",
    "Extended\nList Price",
    "Discounted\nPrice",
    "Markup %",
    "Extended\nDiscounted\nPrice",
  ];
  const headerRow = ws.getRow(1);
  headerRow.height = 30;
  headers.forEach((text, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = text;
    cell.font = { ...BASE_FONT, bold: true, color: { argb: WHITE } };
    cell.fill = fill(TEAL);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder;
  });

  // ---- ROW 2: section header (merged A2:J2) ----
  ws.mergeCells("A2:J2");
  const sectionCell = ws.getCell("A2");
  sectionCell.value = "Hardware/License and Support";
  sectionCell.font = { ...BASE_FONT, bold: true, italic: true };
  sectionCell.fill = fill(SECTION_GRAY);
  sectionCell.alignment = { vertical: "middle", horizontal: "center" };
  for (let c = 1; c <= 10; c++) ws.getRow(2).getCell(c).border = thinBorder;

  // ---- DATA ROWS (start row 3) ----
  const FIRST_DATA_ROW = 3;
  let totalQty = 0;
  let totalList = 0;
  let totalExtList = 0;
  let totalDisc = 0;
  let totalExtDisc = 0;

  items.forEach((item, idx) => {
    const r = FIRST_DATA_ROW + idx;
    const row = ws.getRow(r);
    const qty = item.quantity ?? 0;
    const listPrice = num(item.listPrice);
    const discPrice = num(item.discountedPrice);
    const extList = item.extendedListPrice != null ? num(item.extendedListPrice) : qty * listPrice;
    const extDisc = qty * discPrice;

    totalQty += qty;
    totalList += listPrice;
    totalExtList += extList;
    totalDisc += discPrice;
    totalExtDisc += extDisc;

    const bgColor = idx % 2 === 0 ? ROW_WHITE : ROW_ALT;

    row.getCell(1).value = idx + 1; // Item #
    row.getCell(2).value = item.partNumber ?? "";
    row.getCell(3).value = item.description ?? "";
    row.getCell(4).value = item.eligibilityPercent ?? 100;
    row.getCell(5).value = qty;
    row.getCell(6).value = listPrice;
    row.getCell(7).value = extList;
    row.getCell(8).value = discPrice;
    // I (Markup %): blank, ready for manual entry
    row.getCell(9).value = null;
    // J (Extended Discounted Price): live Excel formula
    row.getCell(10).value = {
      formula: `H${r}*(1+IF(I${r}="",0,I${r}))*E${r}`,
      result: extDisc,
    };

    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.font = { ...BASE_FONT };
      cell.fill = fill(bgColor);
      cell.border = thinBorder;
      if (c <= 3) {
        cell.alignment = { horizontal: "left", vertical: "top", wrapText: c === 3 };
      } else if (c === 9) {
        cell.alignment = { horizontal: "center", vertical: "top" };
      } else {
        cell.alignment = { horizontal: "right", vertical: "top" };
      }
    }
    row.getCell(4).numFmt = '0"%"';
    row.getCell(6).numFmt = MONEY;
    row.getCell(7).numFmt = MONEY;
    row.getCell(8).numFmt = MONEY;
    row.getCell(9).numFmt = "0%";
    row.getCell(10).numFmt = MONEY;
  });

  const LAST_DATA_ROW = FIRST_DATA_ROW + Math.max(items.length, 1) - 1;
  const hasItems = items.length > 0;
  const lastDataRowForSum = hasItems ? LAST_DATA_ROW : FIRST_DATA_ROW;

  // ---- spacer row ----
  const spacer1 = (hasItems ? LAST_DATA_ROW : FIRST_DATA_ROW) + 1;

  // ---- SUBTOTAL ROW ----
  const subtotalRow = spacer1 + 1;
  {
    const row = ws.getRow(subtotalRow);
    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.font = { ...BASE_FONT, bold: true };
      cell.fill = fill(LIGHT_GRAY);
    }
    row.getCell(4).value = "Subtotal";
    row.getCell(4).alignment = { horizontal: "right" };
    row.getCell(5).value = totalQty;
    row.getCell(5).alignment = { horizontal: "right" };
    row.getCell(6).value = totalList;
    row.getCell(6).numFmt = MONEY;
    row.getCell(6).alignment = { horizontal: "right" };
    row.getCell(7).value = totalExtList;
    row.getCell(7).numFmt = MONEY;
    row.getCell(7).alignment = { horizontal: "right" };
    row.getCell(8).value = totalDisc;
    row.getCell(8).numFmt = MONEY;
    row.getCell(8).alignment = { horizontal: "right" };
    // I blank
    row.getCell(10).value = {
      formula: `SUM(J${FIRST_DATA_ROW}:J${lastDataRowForSum})`,
      result: totalExtDisc,
    };
    row.getCell(10).numFmt = MONEY;
    row.getCell(10).alignment = { horizontal: "right" };
  }

  // ---- spacer row ----
  const spacer2 = subtotalRow + 1;

  // ---- NOTES / TOTALS SECTION ----
  const notesRow = spacer2 + 1; // "Subtotal"
  const salesTaxRow = notesRow + 1;
  const shippingRow = salesTaxRow + 1;
  const grandTotalRow = shippingRow + 1;

  // Notes text merged across A-H spanning the three totals rows.
  ws.mergeCells(`A${notesRow}:H${shippingRow}`);
  const notesCell = ws.getCell(`A${notesRow}`);
  notesCell.value =
    "Quote Notes: For Cisco product E-Rate eligibility, please consult the current USAC Eligible Services List. " +
    "E-Rate eligibility percentages shown are estimates and subject to USAC review. Pricing is valid for 30 days from the quote date. " +
    "All prices are in USD. Markup percentages, sales tax, and shipping are to be completed by Questivity staff prior to customer delivery.";
  notesCell.font = { ...BASE_FONT, italic: true };
  notesCell.alignment = { horizontal: "left", vertical: "top", wrapText: true };

  // I/J totals stack
  const setLabelValue = (
    row: number,
    label: string,
    formulaOrValue: { formula: string; result: number } | number,
  ) => {
    const labelCell = ws.getCell(`I${row}`);
    labelCell.value = label;
    labelCell.font = { ...BASE_FONT, bold: true };
    labelCell.fill = fill(LIGHT_GRAY);
    labelCell.alignment = { horizontal: "right", vertical: "middle" };

    const valueCell = ws.getCell(`J${row}`);
    valueCell.value = formulaOrValue as ExcelJS.CellValue;
    valueCell.font = { ...BASE_FONT, bold: true };
    valueCell.fill = fill(LIGHT_GRAY);
    valueCell.alignment = { horizontal: "right", vertical: "middle" };
    valueCell.numFmt = MONEY;
  };

  setLabelValue(notesRow, "Subtotal", { formula: `J${subtotalRow}`, result: totalExtDisc });
  setLabelValue(salesTaxRow, "Sales Tax", 0);
  setLabelValue(shippingRow, "Shipping", 0);

  // ---- GRAND TOTAL ROW ----
  ws.mergeCells(`A${grandTotalRow}:H${grandTotalRow}`);
  const grandNotesCell = ws.getCell(`A${grandTotalRow}`);
  grandNotesCell.font = { ...BASE_FONT };
  ws.getRow(grandTotalRow).height = 18;

  const grandLabel = ws.getCell(`I${grandTotalRow}`);
  grandLabel.value = "GRAND\nTOTAL";
  grandLabel.font = { ...BASE_FONT, bold: true, color: { argb: WHITE } };
  grandLabel.fill = fill(BLACK);
  grandLabel.alignment = { horizontal: "right", vertical: "middle", wrapText: true };

  const grandValue = ws.getCell(`J${grandTotalRow}`);
  grandValue.value = { formula: `J${subtotalRow}`, result: totalExtDisc };
  grandValue.font = { ...BASE_FONT, bold: true, color: { argb: WHITE } };
  grandValue.fill = fill(BLACK);
  grandValue.alignment = { horizontal: "right", vertical: "middle" };
  grandValue.numFmt = MONEY;

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function questivityFilename(quoteId: number): string {
  return `Questivity_Quote_QT${String(quoteId).padStart(5, "0")}.xlsx`;
}
