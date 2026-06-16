import pool from "../services/db.js";

export const KATEGORI_LIST = [
  "modul",
  "poster",
  "seragam",
  "lain-lain"
];

export function kategoriLabel(id) {
  switch(id) {
    case "modul": return "Modul";
    case "poster": return "Poster";
    case "seragam": return "Seragam";
    default: return "Lain-Lain";
  }
}
