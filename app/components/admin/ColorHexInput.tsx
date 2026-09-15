import { useState } from "react";
import { cn } from "~/lib/utils";

export function ColorHexInput({
  name,
  hexName,
  defaultName,
  defaultHex,
  id,
  compact = false,
  palette = [],
  onChange,
}: {
  name: string;
  hexName: string;
  defaultName: string;
  defaultHex: string;
  id?: string;
  compact?: boolean;
  palette?: Array<{ id: string; name: string; hex: string }>;
  onChange?: (next: { name: string; hex: string }) => void;
}) {
  const [hex, setHex] = useState(defaultHex);
  const [colorName, setColorName] = useState(defaultName);
  const safeHex = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#000000";
  const colorId = id ?? name;

  function update(nextName: string, nextHex: string) {
    setColorName(nextName);
    setHex(nextHex);
    onChange?.({ name: nextName, hex: nextHex });
  }

  return (
    <div className="space-y-1">
      <label
        htmlFor={colorId}
        className={cn("block text-sm font-medium text-charcoal", compact && "md:sr-only")}
      >
        Colour
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safeHex}
          onChange={(event) => update(colorName, event.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded-lg border border-charcoal/20 bg-white p-1"
          aria-label="Pick colour"
        />
        <input type="hidden" name={hexName} value={safeHex} />
        <input
          id={colorId}
          name={name}
          value={colorName}
          onChange={(event) => update(event.target.value, hex)}
          required={false}
          placeholder="Navy"
          className="w-full min-w-0 rounded-lg border border-charcoal/20 bg-white px-3 py-2.5 text-sm text-charcoal placeholder:text-charcoal/40 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
      </div>
      {palette.length > 0 && !compact ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {palette.map((color) => {
            const selected = colorName === color.name;
            return (
              <button
                key={color.id}
                type="button"
                title={color.name}
                onClick={() => update(color.name, color.hex)}
                className={cn(
                  "size-11 rounded-full border transition-transform hover:scale-110",
                  selected ? "border-navy ring-2 ring-navy/30" : "border-charcoal/15"
                )}
                style={{ backgroundColor: color.hex }}
                aria-label={color.name}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
