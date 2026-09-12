import {
  MEN_INSEAMS,
  MEN_SIZE_ROWS,
  WOMEN_INSEAMS,
  WOMEN_SIZE_ROWS,
} from "~/lib/size-chart";

const BODY_COLUMNS = [
  { key: "size", label: "Size" },
  { key: "bust", label: "Bust" },
  { key: "waist", label: "Waist" },
  { key: "hip", label: "Hip" },
  { key: "topLength", label: "Top length" },
] as const;

function MeasurementTable({
  title,
  rows,
  inseams,
}: {
  title: string;
  rows: ReadonlyArray<{
    size: string;
    bust: string;
    waist: string;
    hip: string;
    topLength: string;
  }>;
  inseams: { jogger: string; straight: string; tall: string };
}) {
  return (
    <div className="mb-8 overflow-hidden rounded-xl border border-charcoal/10">
      <div className="flex items-baseline justify-between bg-navy px-4 py-3 text-white">
        <h3 className="font-serif text-lg">{title}</h3>
        <p className="text-xs uppercase tracking-[0.14em] text-white/70">Unit: inch</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-176 text-sm">
          <thead>
            <tr className="border-b border-charcoal/10 bg-sand">
              {BODY_COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-3 text-left font-medium text-navy">
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-3 text-left font-medium text-navy">Jogger</th>
              <th className="px-3 py-3 text-left font-medium text-navy">Straight</th>
              <th className="px-3 py-3 text-left font-medium text-navy">Tall</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.size}
                className="border-b border-charcoal/10 last:border-b-0 even:bg-white odd:bg-sand/40"
              >
                <td className="px-3 py-3 font-medium text-navy">{row.size}</td>
                <td className="px-3 py-3 text-charcoal/80">{row.bust}</td>
                <td className="px-3 py-3 text-charcoal/80">{row.waist}</td>
                <td className="px-3 py-3 text-charcoal/80">{row.hip}</td>
                <td className="px-3 py-3 text-charcoal/80">{row.topLength}</td>
                {index === 0 ? (
                  <>
                    <td
                      rowSpan={rows.length}
                      className="border-l border-charcoal/10 px-3 py-3 align-middle text-center font-medium text-charcoal"
                    >
                      {inseams.jogger}
                    </td>
                    <td
                      rowSpan={rows.length}
                      className="px-3 py-3 align-middle text-center font-medium text-charcoal"
                    >
                      {inseams.straight}
                    </td>
                    <td
                      rowSpan={rows.length}
                      className="px-3 py-3 align-middle text-center font-medium text-charcoal"
                    >
                      {inseams.tall}
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SizeChartTables() {
  return (
    <>
      <MeasurementTable title="Male" rows={MEN_SIZE_ROWS} inseams={MEN_INSEAMS} />
      <MeasurementTable title="Female" rows={WOMEN_SIZE_ROWS} inseams={WOMEN_INSEAMS} />
    </>
  );
}
