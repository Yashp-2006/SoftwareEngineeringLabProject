/**
 * tiesheet-pdf-exporter.ts
 *
 * Generates a multi-page PDF — one page per pool.
 * Layout: competition header, info table, bracket columns, medalist section (archived).
 * Scoring columns are displayed BELOW the athlete name to save horizontal space.
 * No round-name headers. BYE slots are shown as blank rows.
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
  akaKata?: string | null;
  aoKata?: string | null;
  nextMatchId?: string | null;
}

export interface TiesheetCategory {
  name: string;
  matches: TiesheetMatch[];
  athletes?: TiesheetAthlete[];
  matNo?: string;
  isKata?: boolean;
}

export interface ExportOptions {
  competitionName: string;
  categories: TiesheetCategory[];
  isArchived?: boolean;
  venue?: string;
  date?: string;
}

/* ─── Color Palette ─────────────────────────────────────────────────────── */
const RED_AKA    = [217, 38,  44]  as [number, number, number];
const BLUE_AO    = [0,   112, 243] as [number, number, number];
const LIGHT_RED  = [255, 225, 225] as [number, number, number];
const LIGHT_BLUE = [220, 235, 255] as [number, number, number];
const GRAY_100   = [248, 248, 248] as [number, number, number];
const GRAY_200   = [220, 220, 220] as [number, number, number];
const GRAY_400   = [155, 155, 155] as [number, number, number];
const BLACK      = [20,  20,  20]  as [number, number, number];
const WHITE      = [255, 255, 255] as [number, number, number];
const GOLD_C     = [180, 130, 0]   as [number, number, number];
const SILVER_C   = [120, 120, 120] as [number, number, number];
const BRONZE_C   = [140, 85,  20]  as [number, number, number];

/* ─── Layout (A4 landscape 297 × 210 mm) ─────────────────────────────── */
const PAGE_W  = 297;
const PAGE_H  = 210;
const MARGIN  = 6;

/* Scoring columns below the name */
const SCORE_COLS  = ['S', 'Y', 'W', 'I', 'C1', 'C2', 'C3', 'HC', 'H'];
const SCORE_ROW_H = 5;    // mm — height of the scores sub-row
const NAME_ROW_H  = 7;    // mm — name + club line
const ATHLETE_H   = NAME_ROW_H + SCORE_ROW_H;  // total per athlete = 12 mm
const BLOCK_H     = ATHLETE_H * 2;              // AKA + AO = 24 mm
const CONNECTOR_W = 8;    // mm gap between rounds

/* ─── Draw one athlete row ──────────────────────────────────────────────── */
function drawAthleteRow(
  doc: jsPDF,
  x: number, y: number, w: number,
  athlete: TiesheetAthlete | null,
  color: [number, number, number],
  lightColor: [number, number, number],
  isWinner: boolean,
  isArchived: boolean,
  isKata: boolean = false,
  kataName: string | null = null
) {
  const nameH = NAME_ROW_H;
  const scoreH = SCORE_ROW_H;

  /* ── Name area background */
  if (athlete) {
    doc.setFillColor(...lightColor);
  } else {
    doc.setFillColor(...GRAY_100); // blank for bye
  }
  doc.rect(x, y, w, nameH, 'F');

  /* ── Accent bar on left */
  doc.setFillColor(...color);
  doc.rect(x, y, 2, nameH, 'F');

  /* ── Outer border */
  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, nameH, 'D');

  /* ── Athlete name */
  if (athlete) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...(isWinner && isArchived ? [0, 130, 60] as [number,number,number] : BLACK));
    doc.text(athlete.name.toUpperCase(), x + 3.5, y + 4, { maxWidth: w - 5 });

    /* ── Academy / ID sub-line */
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(...GRAY_400);
    const sub = [athlete.academy, athlete.playerId].filter(Boolean).join('   ');
    if (sub) doc.text(sub, x + 3.5, y + 6.5, { maxWidth: w - 5 });
  }

  /* ── Score sub-row (below name) */
  const sy = y + nameH;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...GRAY_200);
  doc.rect(x, sy, w, scoreH, 'FD');

  /* Accent bar continues */
  doc.setFillColor(...color);
  doc.rect(x, sy, 2, scoreH, 'F');

  if (!isKata) {
    const colW = (w - 2) / SCORE_COLS.length;
    for (let i = 0; i < SCORE_COLS.length; i++) {
      const cx = x + 2 + i * colW;
      /* vertical separator */
      if (i > 0) {
        doc.setDrawColor(...GRAY_200);
        doc.setLineWidth(0.15);
        doc.line(cx, sy, cx, sy + scoreH);
      }
      /* label */
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.5);
      doc.setTextColor(...GRAY_400);
      doc.text(SCORE_COLS[i], cx + colW / 2, sy + 2.2, { align: 'center' });
      /* score line */
      doc.setDrawColor(...GRAY_200);
      doc.setLineWidth(0.15);
      doc.line(cx + 0.5, sy + 3.8, cx + colW - 0.5, sy + 3.8);
    }
  } else {
    // Kata layout - display kata name or placeholder
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    if (kataName) {
      doc.setTextColor(...BLACK);
      doc.text(kataName.toUpperCase(), x + 2 + (w - 2) / 2, sy + 3.5, { align: 'center', maxWidth: w - 4 });
    } else {
      doc.setTextColor(...GRAY_400);
      doc.setFont('helvetica', 'italic');
      doc.text('KATA NOT SELECTED', x + 2 + (w - 2) / 2, sy + 3.5, { align: 'center', maxWidth: w - 4 });
    }
  }
}

/* ─── Draw one match block ──────────────────────────────────────────────── */
function drawMatchBlock(
  doc: jsPDF,
  x: number, y: number, w: number,
  match: TiesheetMatch | null,
  isArchived: boolean,
  isKata: boolean,
) {
  const akaWins = !!match?.winnerId && match.winnerId === match.aka?.playerId;
  const aoWins  = !!match?.winnerId && match.winnerId === match.ao?.playerId;

  drawAthleteRow(doc, x, y,           w, match?.aka ?? null, RED_AKA,  LIGHT_RED,  akaWins, isArchived, isKata, match?.akaKata ?? null);
  drawAthleteRow(doc, x, y + ATHLETE_H, w, match?.ao  ?? null, BLUE_AO, LIGHT_BLUE, aoWins,  isArchived, isKata, match?.aoKata ?? null);

  /* Outer match border */
  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, BLOCK_H, 'D');
}

/* ─── Build rounds array ───────────────────────────────────────────────── */
function getRounds(matches: TiesheetMatch[]): TiesheetMatch[][] {
  const maxR = Math.max(...matches.map(m => m.round), 1);
  const rounds: TiesheetMatch[][] = [];
  for (let r = 1; r <= maxR; r++) {
    const rm = matches.filter(m => m.round === r).sort((a, b) => a.matchNumber - b.matchNumber);
    if (rm.length) rounds.push(rm);
  }
  return rounds;
}

/* ─── Medalists from matches ────────────────────────────────────────────── */
function getMedalists(matches: TiesheetMatch[], allAthletes: TiesheetAthlete[]) {
  const maxRound = Math.max(...matches.map(m => m.round), 1);
  const finalMatch = matches.find(m => m.round === maxRound);
  const semiMatches = matches.filter(m => m.round === maxRound - 1);

  const goldId = finalMatch?.winnerId;
  const gold = finalMatch ? (finalMatch.aka?.playerId === goldId ? finalMatch.aka : finalMatch.ao) : null;
  const silver = finalMatch ? (finalMatch.aka?.playerId === goldId ? finalMatch.ao : finalMatch.aka) : null;
  const bronzes = semiMatches.map(m => {
    const loserId = m.aka?.playerId === m.winnerId ? m.ao?.playerId : m.aka?.playerId;
    return m.aka?.playerId === loserId ? m.aka : (m.ao ?? null);
  });
  return { gold, silver, bronzes };
}

/* ─── Draw medalist section ─────────────────────────────────────────────── */
function drawMedalistSection(
  doc: jsPDF, x: number, y: number, w: number,
  medalists: ReturnType<typeof getMedalists>,
) {
  const entries = [
    { label: 'GOLD',   color: GOLD_C,   athlete: medalists.gold },
    { label: 'SILVER', color: SILVER_C, athlete: medalists.silver },
    { label: 'BRONZE', color: BRONZE_C, athlete: medalists.bronzes[0] ?? null },
    { label: 'BRONZE', color: BRONZE_C, athlete: medalists.bronzes[1] ?? null },
  ];
  let my = y;
  for (const { label, color, athlete } of entries) {
    const rowH = 8;
    const labelW = 20;
    doc.setFillColor(...color);
    doc.rect(x, my, labelW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...WHITE);
    doc.text(label, x + labelW / 2, my + 5, { align: 'center' });

    doc.setFillColor(...WHITE);
    doc.setDrawColor(...GRAY_200);
    doc.rect(x + labelW, my, w - labelW, rowH, 'FD');

    if (athlete) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...BLACK);
      doc.text(athlete.name.toUpperCase(), x + labelW + 3, my + 3.5, { maxWidth: w - labelW - 5 });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(...GRAY_400);
      if (athlete.academy) doc.text(athlete.academy, x + labelW + 3, my + 6.5, { maxWidth: w - labelW - 5 });
    }
    my += rowH + 1;
  }
}

/* ─── Draw page header ──────────────────────────────────────────────────── */
function drawPageHeader(
  doc: jsPDF,
  compName: string,
  catName: string,
  venue: string,
  date: string,
  matNo: string,
  tiesheetNo: number,
  poolNo: number,
): number {
  const y = MARGIN;

  /* Title bar */
  doc.setFillColor(...RED_AKA);
  doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text(compName.toUpperCase(), PAGE_W / 2, y + 6.2, { align: 'center' });

  /* Subtitle: date & venue */
  let subtitleY = y + 11.5;
  if (date || venue) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...BLACK);
    const parts: string[] = [];
    if (date)  parts.push(`Date: ${date}`);
    if (venue) parts.push(`Venue: ${venue}`);
    doc.text(parts.join('   |   '), PAGE_W / 2, subtitleY, { align: 'center' });
    subtitleY += 5;
  }

  /* Info table top-right */
  const infoX  = PAGE_W - MARGIN - 80;
  const infoY  = y;
  const cellH  = 4.5;
  const col1W  = 28;
  const col2W  = 52;

  const infoRows = [
    ['Age Category', catName],
    ['Tiesheet No',  String(tiesheetNo)],
    ['Pool No',      String(poolNo)],
    ['Mat (Tatami)', matNo || ''],
    ['Time (PM)',    ''],
  ];

  for (let i = 0; i < infoRows.length; i++) {
    const ry = infoY + i * cellH;
    doc.setFillColor(...GRAY_100);
    doc.setDrawColor(...GRAY_200);
    doc.setLineWidth(0.2);
    doc.rect(infoX, ry, col1W, cellH, 'FD');
    doc.rect(infoX + col1W, ry, col2W, cellH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(...GRAY_400);
    doc.text(infoRows[i][0].toUpperCase(), infoX + 1.5, ry + 3);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(...BLACK);
    doc.text(infoRows[i][1], infoX + col1W + 2, ry + 3, { maxWidth: col2W - 4 });
  }

  return subtitleY + 1; // Y where bracket content starts
}

/* ─── Main export function ─────────────────────────────────────────────── */
export async function exportTiesheetsPDF(options: ExportOptions): Promise<void> {
  const {
    competitionName,
    categories,
    isArchived = false,
    venue = '',
    date = '',
  } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let isFirst = true;

  for (let catIdx = 0; catIdx < categories.length; catIdx++) {
    const cat = categories[catIdx];
    if (!cat.matches || cat.matches.length === 0) continue;

    /* Split by pool prefix (Pool1-, Pool2-, ...) */
    const poolIds = Array.from(
      new Set(
        cat.matches
          .filter(m => m.id.includes('-'))
          .map(m => m.id.split('-')[0])
          .filter(p => p.startsWith('Pool'))
      )
    ).sort();

    const pools =
      poolIds.length > 0
        ? poolIds.map(pid => ({
            poolLabel: pid,
            matches: cat.matches.filter(m => m.id.startsWith(pid + '-')),
          }))
        : [{ poolLabel: 'Pool1', matches: cat.matches }];

    for (let pi = 0; pi < pools.length; pi++) {
      const { poolLabel, matches } = pools[pi];
      if (!isFirst) doc.addPage();
      isFirst = false;

      const poolNo = parseInt(poolLabel.replace('Pool', '')) || pi + 1;
      const rounds = getRounds(matches);
      const numRounds = rounds.length;
      if (numRounds === 0) continue;

      /* ── Header */
      const contentY = drawPageHeader(
        doc, competitionName, cat.name, venue, date, cat.matNo || '',
        catIdx + 1, poolNo,
      );

      /* ── Bracket dimensions */
      const bracketY    = contentY + 1;
      const medalistW   = isArchived ? 52 : 0;
      const availW      = PAGE_W - MARGIN * 2 - medalistW - (medalistW > 0 ? 4 : 0);
      const matchW      = Math.floor((availW - (numRounds - 1) * CONNECTOR_W) / numRounds);
      const bracketX    = MARGIN;
      const availH      = PAGE_H - bracketY - MARGIN - 2;

      /* First round drives slot height */
      const r1Count = rounds[0].length;
      const slotH   = availH / r1Count;

      /* ── Draw rounds */
      for (let r = 0; r < numRounds; r++) {
        const rMatches  = rounds[r];
        const rx        = bracketX + r * (matchW + CONNECTOR_W);
        const slotsPerMatch = Math.pow(2, r);
        const matchSlotH    = slotH * slotsPerMatch;

        for (let mi = 0; mi < rMatches.length; mi++) {
          const match = rMatches[mi];
          /* Vertically centre match block in its slot */
          const slotTop = bracketY + mi * matchSlotH;
          const my      = slotTop + (matchSlotH - BLOCK_H) / 2;

          drawMatchBlock(doc, rx, my, matchW, match, isArchived, cat.isKata || cat.name.toLowerCase().includes('kata'));

          /* ── Connector lines to next round */
          if (r < numRounds - 1) {
            const nextSlotsPerMatch = Math.pow(2, r + 1);
            const nextMatchSlotH    = slotH * nextSlotsPerMatch;
            const nextGroupIdx      = Math.floor(mi / 2);
            const nextSlotTop       = bracketY + nextGroupIdx * nextMatchSlotH;
            const nextMy            = nextSlotTop + (nextMatchSlotH - BLOCK_H) / 2;

            /* This match's mid-Y: AKA centre or AO centre */
            const fromY = my + (mi % 2 === 0
              ? ATHLETE_H / 2                  // top match → AKA centre
              : ATHLETE_H + ATHLETE_H / 2);    // bottom match → AO centre

            /* Next match's entry mid-Y */
            const toY = nextMy + (mi % 2 === 0 ? ATHLETE_H / 2 : ATHLETE_H + ATHLETE_H / 2);

            const connX  = rx + matchW;
            const midX   = connX + CONNECTOR_W / 2;

            doc.setDrawColor(...GRAY_400);
            doc.setLineWidth(0.3);
            doc.line(connX, fromY, midX, fromY);       // horizontal out
            if (Math.abs(fromY - toY) > 0.5)
              doc.line(midX, Math.min(fromY, toY), midX, Math.max(fromY, toY)); // vertical join
            doc.line(midX, toY, connX + CONNECTOR_W, toY); // horizontal into next
          }
        }
      }

      /* ── Medalist section (archived) */
      if (isArchived) {
        const allAthletes =
          cat.athletes ??
          (matches.flatMap(m => [m.aka, m.ao]).filter(Boolean) as TiesheetAthlete[]);
        const medalists = getMedalists(matches, allAthletes);
        const medX = bracketX + numRounds * (matchW + CONNECTOR_W) + 4;
        const medY = bracketY + availH * 0.2;
        const medW = medalistW - 4;
        if (medW > 30) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(...BLACK);
          doc.text('MEDALISTS', medX + medW / 2, medY - 3, { align: 'center' });
          drawMedalistSection(doc, medX, medY, medW, medalists);
        }
      }
    }
  }

  const fileName = `${competitionName.replace(/[^a-z0-9]/gi, '_')}_Tiesheets.pdf`;
  doc.save(fileName);
}
