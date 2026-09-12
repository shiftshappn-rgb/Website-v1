import { useEffect } from "react";
import { X } from "lucide-react";
import { SizeChartTables } from "~/components/storefront/SizeChartTables";

export function SizeChartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-charcoal/40"
        aria-label="Close size chart"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-lg flex-col bg-sand shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="size-chart-title"
      >
        <div className="flex items-center justify-between border-b border-charcoal/10 px-5 py-4">
          <h2 id="size-chart-title" className="font-serif text-2xl text-navy">
            Size chart
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal/60 hover:text-charcoal"
            aria-label="Close size chart"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <p className="mb-6 text-sm text-charcoal/70">
            All measurements are in inches. Inseams stay the same across sizes and change
            by pant style: Jogger, Straight, and Tall.
          </p>
          <SizeChartTables />
          <div className="space-y-3 text-sm text-charcoal/80">
            <h3 className="font-serif text-xl text-navy">How to measure</h3>
            <p>
              <strong>Bust/Chest:</strong> Measure around the fullest part of your chest,
              keeping the tape parallel to the floor.
            </p>
            <p>
              <strong>Waist:</strong> Measure around your natural waistline, the narrowest
              part of your torso.
            </p>
            <p>
              <strong>Hip:</strong> Measure around the fullest part of your hips, about 8
              inches below your waist.
            </p>
            <p>
              <strong>Top length:</strong> Measure from the high point of the shoulder down
              to the hem.
            </p>
            <p>
              <strong>Inseam:</strong> Jogger is cuffed, Straight is regular, and Tall is
              lengthened.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
