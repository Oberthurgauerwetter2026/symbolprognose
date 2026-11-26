// Merkt sich die zuletzt geöffnete Kachel, damit die Detailseite beim
// Zurückgehen wieder genau in diese Kachel zurückschrumpft.
let lastCard: string | null = null;
export const getMorphCard = () => lastCard;
export const setMorphCard = (path: string) => { lastCard = path; };
