// app/properties/[id]/tools/page.tsx
import Link from 'next/link';

const TOOLS = [
  {
    slug: 'price-scanner',
    icon: '💲',
    title: 'Price Scanner',
    description: 'Photograph a product, find a cheaper equivalent.',
  },
  {
    slug: 'ingredient-scanner',
    icon: '🔬',
    title: 'Ingredient Scanner',
    description: "Photograph a label, get a plain-language, evidence-based read.",
  },
  {
    slug: 'recipe-stealer',
    icon: '🍽️',
    title: 'Copycat Recipe',
    description: 'Photograph a dish, get a home-cookable recipe.',
  },
];

export default async function ToolsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-aubergine mb-4">Tools</h1>
      <ul className="space-y-3">
        {TOOLS.map((tool) => (
          <li key={tool.slug}>
            <Link
              href={`/properties/${id}/tools/${tool.slug}`}
              className="flex items-center gap-3 bg-white rounded-2xl shadow-sm shadow-aubergine/5 px-4 py-3 hover:bg-gold-light/15 transition-colors"
            >
              <span className="text-2xl">{tool.icon}</span>
              <span>
                <span className="block font-display text-lg text-aubergine">{tool.title}</span>
                <span className="block text-sm text-ink/50">{tool.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
