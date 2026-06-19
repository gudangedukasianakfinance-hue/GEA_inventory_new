import pool from "../services/db.js";

export const KATEGORI_LIST = [
  "modul",
  "poster",
  "seragam",
  "panduan",
  "tas",
  "lain_lain",
  "lain-lain"
];

export function kategoriLabel(id) {
  switch(id) {
    case "modul": return "Modul";
    case "poster": return "Poster";
    case "seragam": return "Seragam";
    case "panduan": return "Panduan";
    case "tas": return "Tas";
    default: return "Lain-Lain";
  }
}
