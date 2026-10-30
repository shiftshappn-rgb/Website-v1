export const SHIFTKNIT_COMPOSITION =
  "72% polyester · 21% rayon · 7% spandex" as const;

export const MOMENTS = [
  {
    time: "07:00",
    title: "Handover",
    body: "Soft against your skin from the first minute of your shift.",
    photo: "PHOTO · Start of shift, coffee in hand.",
  },
  {
    time: "09:30",
    title: "The bed bath",
    body: "Crouch down to bedside height. The stretch goes with you.",
    photo: "PHOTO · Crouching at bedside height.",
  },
  {
    time: "13:00",
    title: "The top shelf",
    body: "Reach the back of the supply room without fighting your scrubs.",
    photo: "PHOTO · Reaching the top supply shelf.",
  },
  {
    time: "19:00",
    title: "The walk to your car",
    body: "Built for the last hour of your shift, not just the first.",
    photo: "PHOTO · Walking to the car at dusk.",
  },
] as const;

export const FIBRE_FEATURES = [
  {
    label: "SHAPE · 72% POLYESTER",
    headline: "Goodbye, baggy by lunch.",
    body: "Polyester is a strong fibre that helps your scrubs hold their shape through the shift.",
    highlight: "72% polyester",
    photo: "PHOTO · Close-up of a crisp knee and hem",
  },
  {
    label: "SOFT · 21% RAYON",
    headline: "Goodbye, scratchy.",
    body: "Rayon is made from plant cellulose. It gives SHIFTKNIT™ its soft feel and natural drape.",
    highlight: "21% rayon",
    photo: "PHOTO · A hand running over the fabric",
  },
  {
    label: "STRETCH · 7% SPANDEX",
    headline: "Goodbye, pulling and tugging.",
    body: "Spandex gives when you bend, crouch and reach, then settles back into shape.",
    highlight: "7% spandex",
    photo: "PHOTO · Reaching overhead, top stays put",
  },
] as const;

export const AT_A_GLANCE = [
  { icon: "stretch" as const, label: "Stretch from 7% spandex" },
  { icon: "leaf" as const, label: "Soft feel from rayon" },
  { icon: "shape" as const, label: "Built to hold its shape" },
  { icon: "ban" as const, label: "No antimicrobial chemicals added" },
  { icon: "hanger" as const, label: "Same fabric in all styles" },
  { icon: "ruler" as const, label: "Sizes up to 3XL" },
  { icon: "tag" as const, label: "One price, never on sale" },
  { icon: "pin" as const, label: "Delivered on Shift Drop day" },
];

export const HOW_IT_WORKS = [
  {
    pct: "72% polyester",
    role: "THE STRUCTURE",
    body: "A strong fibre that helps the fabric hold its shape.",
    barClass: "bg-white",
    width: "72%",
  },
  {
    pct: "21% rayon",
    role: "THE SOFTNESS",
    body: "Made from plant cellulose, for a soft feel and natural drape.",
    barClass: "bg-sky",
    width: "21%",
  },
  {
    pct: "7% spandex",
    role: "THE STRETCH",
    body: "An elastic fibre that stretches when you move and recovers after.",
    barClass: "bg-gold",
    width: "7%",
  },
] as const;

export const SHIFTKNIT_FAQS = [
  {
    q: "What is SHIFTKNIT™?",
    a: "The fabric used in every ShiftsHappn scrub: a soft, stretchy blend of 72% polyester, 21% rayon and 7% spandex.",
  },
  {
    q: "Which scrubs are made with SHIFTKNIT™?",
    a: "Every scrub style in the ShiftsHappn collection is made with SHIFTKNIT™ — same fabric across all styles.",
  },
  {
    q: "Is SHIFTKNIT™ antimicrobial?",
    a: "No antimicrobial chemicals are added. Softness and stretch come from the fibre blend itself.",
  },
  {
    q: "How do I wash it?",
    a: "Machine wash cold with like colours. Tumble dry low or hang to dry. Avoid bleach and fabric softener.",
  },
  {
    q: "What sizes does it come in?",
    a: "Sizes up to 3XL. Check the size chart for detailed measurements for tops and pants.",
  },
  {
    q: "How do I get it?",
    a: "Order online and pick up via free Shift Drop at a Halifax hospital site and time window you choose at checkout.",
  },
] as const;
