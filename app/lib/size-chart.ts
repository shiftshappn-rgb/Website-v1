export const WOMEN_SIZE_ROWS = [
  { size: "XXS", bust: "33–34", waist: "24–25", hip: "34–35", topLength: "24.8" },
  { size: "XS", bust: "34–35", waist: "27–28", hip: "36–38", topLength: "25.2" },
  { size: "S", bust: "38–39", waist: "29–30", hip: "39–40", topLength: "26" },
  { size: "M", bust: "40–42", waist: "30–32", hip: "41–43", topLength: "26.8" },
  { size: "L", bust: "42–44", waist: "33–35", hip: "42–45", topLength: "27.6" },
  { size: "XL", bust: "42–46", waist: "34–37", hip: "44–47", topLength: "28.3" },
  { size: "XXL", bust: "47–49", waist: "38–40", hip: "47–50", topLength: "29.1" },
  { size: "3XL", bust: "49–51", waist: "39–42", hip: "49–52", topLength: "29.9" },
  { size: "4XL", bust: "52–54", waist: "41–44", hip: "51–54", topLength: "30.3" },
  { size: "5XL", bust: "54–56", waist: "43–46", hip: "53–56", topLength: "30.7" },
] as const;

export const MEN_SIZE_ROWS = [
  { size: "XS", bust: "38–40", waist: "27–28", hip: "36–38", topLength: "28.3" },
  { size: "S", bust: "39–42", waist: "29–31", hip: "39–41", topLength: "29.5" },
  { size: "M", bust: "41–45", waist: "30–33", hip: "40–43", topLength: "29.9" },
  { size: "L", bust: "44–47", waist: "33–35", hip: "43–45", topLength: "30.3" },
  { size: "XL", bust: "48–50", waist: "35–37", hip: "45–47", topLength: "30.7" },
  { size: "XXL", bust: "49–52", waist: "38–40", hip: "48–50", topLength: "31.1" },
  { size: "3XL", bust: "52–54", waist: "42–43", hip: "50–52", topLength: "31.5" },
  { size: "4XL", bust: "54–56", waist: "43–45", hip: "52–54", topLength: "31.9" },
  { size: "5XL", bust: "55–59", waist: "45–47", hip: "55–57", topLength: "32.3" },
] as const;

export const WOMEN_INSEAMS = {
  jogger: "29",
  straight: "31",
  tall: "33",
} as const;

export const MEN_INSEAMS = {
  jogger: "31",
  straight: "33",
  tall: "35",
} as const;

export const PANT_LENGTHS = [
  { length: "Jogger", women: `${WOMEN_INSEAMS.jogger}"`, men: `${MEN_INSEAMS.jogger}"` },
  { length: "Straight", women: `${WOMEN_INSEAMS.straight}"`, men: `${MEN_INSEAMS.straight}"` },
  { length: "Tall", women: `${WOMEN_INSEAMS.tall}"`, men: `${MEN_INSEAMS.tall}"` },
] as const;

export const DEFAULT_LENGTH_GUIDE = "Jogger · Straight · Tall";
