const ROWS: [string, string][] = [
  ['Personalise a ready-made template', 'Build or customise the experience'],
  ['Change text and button labels', 'Add or remove steps'],
  ['Change photos', 'Reorder steps'],
  ['Change music', 'Change the flow and branches'],
  ['Add your gift', 'Add new kinds of steps and gifts'],
  ['Fixed steps, as designed', 'As many steps as you like'],
];

/**
 * The one-glance difference between the two paid levels. Kept short on purpose: nobody should
 * need to read documentation to know which one they want.
 */
export function PlusProCompare({ className = '' }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl ring-1 ring-ink-200 ${className}`}
      data-testid="plus-pro"
    >
      <table className="w-full table-fixed text-left text-[13px] leading-snug">
        <caption className="sr-only">PLUS compared with PRO</caption>
        <thead>
          <tr>
            <th scope="col" className="bg-brand-50 px-3 py-2 align-top">
              <span className="block text-xs font-bold tracking-widest text-brand-700">PLUS</span>
              <span className="block font-medium text-ink-700">
                Templates are for personalising
              </span>
            </th>
            <th scope="col" className="bg-ink-900 px-3 py-2 align-top text-white">
              <span className="block text-xs font-bold tracking-widest text-brand-200">PRO</span>
              <span className="block font-medium text-ink-100">PRO is for creating</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {ROWS.map(([plus, pro]) => (
            <tr key={plus}>
              <td className="px-3 py-2 align-top text-ink-800">
                <span aria-hidden="true" className="mr-1 text-brand-600">
                  ✓
                </span>
                {plus}
              </td>
              <td className="bg-ink-50 px-3 py-2 align-top text-ink-800">
                <span aria-hidden="true" className="mr-1 text-ink-900">
                  ✓
                </span>
                {pro}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
