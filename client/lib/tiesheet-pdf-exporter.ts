/**
 * tiesheet-pdf-exporter.ts
 *
 * Generates a multi-page PDF where each page = one pool's tiesheet.
 * Layout matches the reference Khel Karate Championship format.
 * Uses jsPDF for pure client-side generation (no server needed).
 */

import jsPDF from 'jspdf';

/* ─── Types ─────────────────────────────────────────────────────────────── */
export interface TiesheetAthlete {
  name: string;
  academy?: string;
  playerId?: string;
  state?: string;
  country?: string;
}

export interface TiesheetMatch {
  id: string;
  round: number;
  matchNumber: number;
  aka: TiesheetAthlete | null;
  ao: TiesheetAthlete | null;
  winnerId?: string | null;
  akaScore?: number;
  aoScore?: number;
  nextMatchId?: string | null;
}

export interface TiesheetCategory {
  name: string;
  matches: TiesheetMatch[];
  athletes?: TiesheetAthlete[];
}

export interface ExportOptions {
  competitionName: string;
  categories: TiesheetCategory[];
  isArchived?: boolean;
  venue?: string;
  date?: string;
}

/* ─── Color Palette (matching app CSS vars) ────────────────────────────── */
const RED_AKA    = [217, 38,  44]  as [number, number, number]; // --aka
const BLUE_AO    = [0,   112, 243] as [number, number, number]; // --ao
const LIGHT_RED  = [255, 210, 210] as [number, number, number];
const LIGHT_BLUE = [210, 230, 255] as [number, number, number];
const GRAY_100   = [245, 245, 245] as [number, number, number];
const GRAY_200   = [220, 220, 220] as [number, number, number];
const GRAY_400   = [160, 160, 160] as [number, number, number];
const BLACK      = [20,  20,  20]  as [number, number, number];
const WHITE      = [255, 255, 255] as [number, number, number];
const GOLD       = [200, 155, 0]   as [number, number, number];
const SILVER     = [140, 140, 140] as [number, number, number];
const BRONZE     = [160, 100, 30]  as [number, number, number];

/* ─── Layout Constants (A4 landscape: 297 x 210 mm) ──────────────────── */
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 6;

/* Scoring columns header labels */
const SCORE_COLS = ['S', 'Y', 'W', 'I', 'C1', 'C2', 'C3', 'HC', 'H'];
const SCORE_W = 5.5; // mm each

/* Each athlete block height */
const ROW_H = 8;     // mm per athlete row
const BLOCK_H = ROW_H * 2; // AKA + AO

/* ─── Helper: draw a rounded rect ──────────────────────────────────────── */
function rRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fill?: [number, number, number], stroke?: [number, number, number]) {
  if (fill) { doc.setFillColor(...fill); }
  if (stroke) { doc.setDrawColor(...stroke); } else { doc.setDrawColor(200, 200, 200); }
  doc.roundedRect(x, y, w, h, r, r, fill && stroke ? 'FD' : fill ? 'F' : 'D');
}

/* ─── Draw one athlete row ──────────────────────────────────────────────── */
function drawAthleteRow(
  doc: jsPDF,
  x: number, y: number, w: number,
  athlete: TiesheetAthlete | null,
  color: [number, number, number],
  lightColor: [number, number, number],
  side: 'AKA' | 'AO',
  score: number = 0,
  isWinner = false,
  isArchived = false,
) {
  const h = ROW_H;

  // Background
  doc.setFillColor(...lightColor);
  doc.rect(x, y, w, h, 'F');

  // Side accent bar
  doc.setFillColor(...color);
  doc.rect(x, y, 2, h, 'F');

  // Border
  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'D');

  // Winner highlight overlay
  if (isWinner && isArchived) {
    doc.setFillColor(220, 255, 220);
    doc.setGState(new (doc as any).GState({ opacity: 0.4 }));
    doc.rect(x, y, w, h, 'F');
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
  }

  // Score columns area (right side)
  const scoreTotalW = SCORE_COLS.length * SCORE_W;
  const nameW = w - scoreTotalW - 2;

  // Athlete name (bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...BLACK);
  const nameText = athlete ? athlete.name.toUpperCase() : 'BYE';
  doc.text(nameText, x + 3, y + 3.5, { maxWidth: nameW - 2 });

  // Academy / ID line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(...GRAY_400);
  if (athlete) {
    const sub = [athlete.academy, athlete.playerId].filter(Boolean).join(' — ');
    doc.text(sub, x + 3, y + 6.5, { maxWidth: nameW - 2 });
  }

  // Score column separators + labels (only draw if first match in round, but we draw always for simplicity)
  for (let i = 0; i < SCORE_COLS.length; i++) {
    const sx = x + nameW + i * SCORE_W;
    doc.setFillColor(...GRAY_100);
    doc.rect(sx, y, SCORE_W, h, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.5);
    doc.setTextColor(...GRAY_400);
    doc.text(SCORE_COLS[i], sx + SCORE_W / 2, y + 3, { align: 'center' });
    // Score line
    doc.setDrawColor(...GRAY_200);
    doc.setLineWidth(0.15);
    doc.line(sx + 1, y + 5.5, sx + SCORE_W - 1, y + 5.5);
  }

  // Actual score display (archived mode)
  if (isArchived && score != null) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...color);
    doc.text(String(score), x + w - scoreTotalW - 8, y + 5, { align: 'right' });
  }
}

/* ─── Draw one match block (AKA + AO) ──────────────────────────────────── */
function drawMatchBlock(
  doc: jsPDF,
  x: number, y: number, w: number,
  match: TiesheetMatch | null,
  isArchived: boolean,
) {
  const akaIsWinner = match?.winnerId != null && match.winnerId === match.aka?.playerId;
  const aoIsWinner = match?.winnerId != null && match.winnerId === match.ao?.playerId;

  drawAthleteRow(doc, x, y,       w, match?.aka ?? null, RED_AKA,  LIGHT_RED,  'AKA', match?.akaScore ?? 0, akaIsWinner, isArchived);
  drawAthleteRow(doc, x, y + ROW_H, w, match?.ao  ?? null, BLUE_AO, LIGHT_BLUE, 'AO',  match?.aoScore ?? 0,  aoIsWinner, isArchived);

  // Connector tick on right side (line to next round)
  doc.setDrawColor(...GRAY_400);
  doc.setLineWidth(0.3);
  doc.line(x + w, y + ROW_H / 2, x + w + 1, y + ROW_H / 2);
  doc.line(x + w, y + ROW_H * 1.5, x + w + 1, y + ROW_H * 1.5);
}

/* ─── Extract rounds from matches ───────────────────────────────────────── */
function getRounds(matches: TiesheetMatch[]): TiesheetMatch[][] {
  const maxRound = Math.max(...matches.map(m => m.round));
  const rounds: TiesheetMatch[][] = [];
  for (let r = 1; r <= maxRound; r++) {
    rounds.push(matches.filter(m => m.round === r).sort((a, b) => a.matchNumber - b.matchNumber));
  }
  return rounds;
}

/* ─── Determine medalists from matches ─────────────────────────────────── */
function getMedalists(matches: TiesheetMatch[], allAthletes: TiesheetAthlete[]) {
  const maxRound = Math.max(...matches.map(m => m.round));
  const finalMatch = matches.find(m => m.round === maxRound);
  const semiMatches = matches.filter(m => m.round === maxRound - 1);

  const findAthlete = (playerId?: string | null) =>
    allAthletes.find(a => a.playerId === playerId) ?? null;

  const goldId = finalMatch?.winnerId;
  const goldAthlete = finalMatch
    ? (finalMatch.aka?.playerId === goldId ? finalMatch.aka : finalMatch.ao)
    : null;

  const silverAthlete = finalMatch
    ? (finalMatch.aka?.playerId === goldId ? finalMatch.ao : finalMatch.aka)
    : null;

  const bronzes: (TiesheetAthlete | null)[] = semiMatches.map(m => {
    const loserId = m.aka?.playerId === m.winnerId ? m.ao?.playerId : m.aka?.playerId;
    return m.aka?.playerId === loserId ? m.aka : m.ao ?? null;
  });

  return { gold: goldAthlete, silver: silverAthlete, bronzes };
}

/* ─── Draw medalist section ─────────────────────────────────────────────── */
function drawMedalistSection(doc: jsPDF, x: number, y: number, w: number, medalists: ReturnType<typeof getMedalists>) {
  const labels = [
    { label: 'GOLD',   color: GOLD,   athlete: medalists.gold },
    { label: 'SILVER', color: SILVER, athlete: medalists.silver },
    { label: 'BRONZE', color: BRONZE, athlete: medalists.bronzes[0] ?? null },
    { label: 'BRONZE', color: BRONZE, athlete: medalists.bronzes[1] ?? null },
  ];

  let my = y;
  for (const { label, color, athlete } of labels) {
    // Label
    doc.setFillColor(...color);
    doc.rect(x, my, 18, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...WHITE);
    doc.text(label, x + 9, my + 4.5, { align: 'center' });

    // Name box
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...GRAY_200);
    doc.rect(x + 18, my, w - 18, 7, 'FD');

    if (athlete) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...BLACK);
      doc.text(athlete.name.toUpperCase(), x + 20, my + 4.5, { maxWidth: w - 22 });
    }

    my += 8;
  }
}

/* ─── Draw header ───────────────────────────────────────────────────────── */
function drawPageHeader(
  doc: jsPDF,
  compName: string,
  catName: string,
  venue: string,
  date: string,
  tiesheetNo: number,
  poolNo: number,
) {
  const y = MARGIN;

  // Title bar
  doc.setFillColor(...RED_AKA);
  doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(compName.toUpperCase(), PAGE_W / 2, y + 6, { align: 'center' });

  // Subtitle: date & venue
  const subtitleY = y + 11;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...BLACK);
  if (date || venue) {
    doc.text(`${date ? `Date: ${date}` : ''}${venue ? `   |   Venue: ${venue}` : ''}`, PAGE_W / 2, subtitleY, { align: 'center' });
  }

  // Right panel: event info table
  const infoX = PAGE_W - MARGIN - 75;
  const infoY = y;
  const cellH = 4.5;
  const col1W = 28;
  const col2W = 47;

  const infoRows = [
    ['Event',      catName],
    ['Tiesheet No', String(tiesheetNo)],
    ['Pool No',     String(poolNo)],
    ['Tatami No',   ''],
    ['Time (PM)',   ''],
  ];

  doc.setFillColor(...GRAY_100);
  doc.rect(infoX, infoY, col1W + col2W, cellH * infoRows.length, 'F');

  for (let i = 0; i < infoRows.length; i++) {
    const ry = infoY + i * cellH;
    doc.setDrawColor(...GRAY_200);
    doc.setLineWidth(0.2);
    doc.rect(infoX, ry, col1W, cellH, 'D');
    doc.rect(infoX + col1W, ry, col2W, cellH, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...GRAY_400);
    doc.text(infoRows[i][0], infoX + 2, ry + 3.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...BLACK);
    doc.text(infoRows[i][1], infoX + col1W + 2, ry + 3.2, { maxWidth: col2W - 4 });
  }

  return subtitleY + 5; // return Y after header
}

/* ─── Draw bracket column header ────────────────────────────────────────── */
function drawRoundHeader(doc: jsPDF, x: number, y: number, w: number, label: string) {
  doc.setFillColor(...BLACK);
  doc.rect(x, y, w, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(...WHITE);
  doc.text(label, x + w / 2, y + 3.3, { align: 'center' });
}

/* ─── Main: Draw one pool per page ──────────────────────────────────────── */
export async function exportTiesheetsPDF(options: ExportOptions): Promise<void> {
  const { competitionName, categories, isArchived = false, venue = '', date = '' } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let isFirst = true;

  // Process pools: categories with id starting "Pool" are split; others are single pools
  for (let catIdx = 0; catIdx < categories.length; catIdx++) {
    const cat = categories[catIdx];
    if (!cat.matches || cat.matches.length === 0) continue;

    // Find unique pools
    const poolIds = Array.from(new Set(cat.matches.filter(m => m.id.startsWith('Pool')).map(m => m.id.split('-')[0])));
    const pools: { poolLabel: string; matches: TiesheetMatch[] }[] = poolIds.length > 0
      ? poolIds.map(pid => ({ poolLabel: pid, matches: cat.matches.filter(m => m.id.startsWith(pid + '-')) }))
      : [{ poolLabel: 'Pool1', matches: cat.matches }];

    for (let pi = 0; pi < pools.length; pi++) {
      const { poolLabel, matches } = pools[pi];
      if (!isFirst) doc.addPage();
      isFirst = false;

      const poolNo = parseInt(poolLabel.replace('Pool', '')) || pi + 1;
      const rounds = getRounds(matches);
      const numRounds = rounds.length;

      // ── Header
      const contentStartY = drawPageHeader(doc, competitionName, cat.name, venue, date, catIdx + 1, poolNo);

      // ── Layout calculation
      // Available area for bracket
      const bracketY = contentStartY + 2;
      const bracketH = PAGE_H - bracketY - MARGIN - (isArchived ? 40 : 4); // space for medalists if archived
      
      // Each round column width: name area + score cols
      const SCORE_SECTION_W = SCORE_COLS.length * SCORE_W;
      const matchW = 65 + SCORE_SECTION_W; // 65mm for name + academy
      const connectorW = 6; // gap between rounds

      const totalBracketW = numRounds * matchW + (numRounds - 1) * connectorW;
      const bracketX = MARGIN;

      // ── Round column headers
      const roundNames = rounds.map((_, i) => {
        if (i === numRounds - 1) return 'FINAL';
        if (i === numRounds - 2) return 'SEMI FINAL';
        return `ROUND ${i + 1}`;
      });

      for (let r = 0; r < numRounds; r++) {
        const rx = bracketX + r * (matchW + connectorW);
        drawRoundHeader(doc, rx, bracketY, matchW, roundNames[r]);
      }

      const matchStartY = bracketY + 6;
      const availH = bracketH - 6;

      // ── Draw bracket
      // Round 1 determines match spacing
      const r1Matches = rounds[0];
      const slotH = availH / r1Matches.length;

      for (let r = 0; r < numRounds; r++) {
        const rMatches = rounds[r];
        const rx = bracketX + r * (matchW + connectorW);
        const slotsPerMatch = Math.pow(2, r); // round 1 = 1 slot, round 2 = 2, etc.
        const matchSlotH = slotH * slotsPerMatch;

        for (let mi = 0; mi < rMatches.length; mi++) {
          const match = rMatches[mi];
          const my = matchStartY + mi * matchSlotH + (matchSlotH - BLOCK_H) / 2;
          drawMatchBlock(doc, rx, my, matchW, match, isArchived);

          // Connector lines to next round
          if (r < numRounds - 1) {
            const nextSlotH = slotH * Math.pow(2, r + 1);
            const nextGroupIdx = Math.floor(mi / 2);
            const nextMatchY = matchStartY + nextGroupIdx * nextSlotH + (nextSlotH - BLOCK_H) / 2;
            const midY = nextMatchY + (mi % 2 === 0 ? ROW_H / 2 : ROW_H * 1.5);
            const connX = rx + matchW;
            const connEndX = connX + connectorW;

            doc.setDrawColor(...GRAY_400);
            doc.setLineWidth(0.3);
            // Horizontal out from match
            const fromY = my + (mi % 2 === 0 ? ROW_H / 2 : ROW_H * 1.5);
            doc.line(connX + 1, fromY, connX + connectorW / 2, fromY);
            // Vertical join
            const topY = Math.min(fromY, midY);
            const botY = Math.max(fromY, midY);
            if (topY !== botY) doc.line(connX + connectorW / 2, topY, connX + connectorW / 2, botY);
            // Horizontal into next round
            doc.line(connX + connectorW / 2, midY, connEndX, midY);
          }
        }
      }

      // ── Medalist section (archived only)
      if (isArchived) {
        const allAthletes = cat.athletes ?? matches.flatMap(m => [m.aka, m.ao]).filter(Boolean) as TiesheetAthlete[];
        const medalists = getMedalists(matches, allAthletes);
        const medX = bracketX + totalBracketW + 12;
        const medY = matchStartY + availH / 4;
        const medW = PAGE_W - MARGIN - medX;
        if (medW > 40) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(...BLACK);
          doc.text('MEDALISTS', medX + medW / 2, medY - 4, { align: 'center' });
          drawMedalistSection(doc, medX, medY, medW, medalists);
        }
      }
    }
  }

  // Save
  const fileName = `${competitionName.replace(/[^a-z0-9]/gi, '_')}_Tiesheets.pdf`;
  doc.save(fileName);
}
