import type { Route } from "./+types/size-chart";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Size chart — shiftshappn",
    description: "Find your perfect fit with the shiftshappn size chart for women's and men's scrubs.",
    path: "/size-chart",
  });
}

const womenSizes = [
  { size: "XS", bust: '32"', waist: '24"', hip: '34"' },
  { size: "S", bust: '34"', waist: '26"', hip: '36"' },
  { size: "M", bust: '36"', waist: '28"', hip: '38"' },
  { size: "L", bust: '38"', waist: '30"', hip: '40"' },
  { size: "XL", bust: '40"', waist: '32"', hip: '42"' },
  { size: "2XL", bust: '42"', waist: '34"', hip: '44"' },
];

const menSizes = [
  { size: "S", chest: '36"', waist: '30"', hip: '37"' },
  { size: "M", chest: '38"', waist: '32"', hip: '39"' },
  { size: "L", chest: '40"', waist: '34"', hip: '41"' },
  { size: "XL", chest: '42"', waist: '36"', hip: '43"' },
  { size: "2XL", chest: '44"', waist: '38"', hip: '45"' },
];

function SizeTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: Record<string, string>[];
}) {
  return (
    <div className="mb-12">
      <h2 className="text-2xl font-serif text-navy mb-4">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-navy/20">
              {columns.map((col) => (
                <th key={col.key} className="py-3 px-4 text-left font-medium text-navy">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.size} className="border-b border-charcoal/10">
                {columns.map((col) => (
                  <td key={col.key} className="py-3 px-4 text-charcoal/80">
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SizeChart({}: Route.ComponentProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <h1 className="text-3xl lg:text-4xl font-serif text-navy mb-2">Size chart</h1>
      <p className="text-charcoal/70 mb-10">
        All measurements are in inches. If you're between sizes, we recommend sizing up
        for a more relaxed fit.
      </p>

      <SizeTable
        title="Women"
        columns={[
          { key: "size", label: "Size" },
          { key: "bust", label: "Bust" },
          { key: "waist", label: "Waist" },
          { key: "hip", label: "Hip" },
        ]}
        rows={womenSizes}
      />
      <SizeTable
        title="Men"
        columns={[
          { key: "size", label: "Size" },
          { key: "chest", label: "Chest" },
          { key: "waist", label: "Waist" },
          { key: "hip", label: "Hip" },
        ]}
        rows={menSizes}
      />

      <div className="prose-brand">
        <h2>How to measure</h2>
        <p>
          <strong>Bust/Chest:</strong> Measure around the fullest part of your chest, keeping
          the tape parallel to the floor.
        </p>
        <p>
          <strong>Waist:</strong> Measure around your natural waistline, the narrowest part
          of your torso.
        </p>
        <p>
          <strong>Hip:</strong> Measure around the fullest part of your hips, about 8 inches
          below your waist.
        </p>
      </div>
    </div>
  );
}
