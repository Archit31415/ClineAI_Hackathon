export const CROP_FEATURES: [string, string][] = [
  ["diamond_lesions", "◆ Diamond spots"], ["grey_centre_brown_margin", "Grey centre, brown edge"], ["leaf_spots", "Spots"],
  ["wavy_yellow_margin", "Wavy yellow edge"], ["yellowing_from_tip", "Yellow tip"], ["brown_oval_spots", "Brown oval spots"],
  ["yellow_halo", "Yellow halo"], ["hopper_burn_patches", "Round dry patches"], ["insects_at_base", "Insects at base"],
  ["orange_pustules", "Orange powder"], ["yellow_stripes", "Yellow stripes"], ["whole_plant_yellow", "Whole plant yellow"],
];

export const LIVESTOCK_FEATURES: [string, string][] = [
  ["fever", "🌡 Fever"], ["skin_nodules", "Skin lumps"], ["not_eating", "Not eating"], ["reduced_milk", "Less milk"],
  ["cannot_stand", "Cannot stand"], ["bloody_discharge", "Blood"], ["udder_swelling", "Swollen udder"], ["milk_change", "Milk clots"],
  ["bloated_left_abdomen", "Bloated belly"], ["mouth_blisters", "Mouth blisters"], ["foot_lesions", "Limping"], ["diarrhoea", "Diarrhoea"],
  ["cough_nasal_discharge", "Cough"], ["sudden_death_herd", "Sudden death in herd"],
];

export function Chips({ options, sel, toggle }: { options: [string, string][]; sel: string[]; toggle: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([id, label]) => (
        <button key={id} onClick={() => toggle(id)}
          className={`rounded-full px-3 py-1.5 text-sm ring-1 ${sel.includes(id) ? "bg-green-700 text-white ring-green-700" : "bg-white ring-stone-300"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
