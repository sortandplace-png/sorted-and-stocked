// app/scan/[code]/page.tsx
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

interface ScanPageProps {
  params: Promise<{ code: string }>;
}

export default async function ScanPage({ params }: ScanPageProps) {
  const { code } = await params;
  const supabase = await createClient();

  // Query inventory item by QR code
  // Assumes code format: ITM-XXXXXXXX or similar barcode
  const { data: item, error } = await supabase
    .from('inventory_items')
    .select('id, property_id, name')
    .eq('qr_code', code)
    .single();

  if (error || !item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-md mx-auto text-center">
        <div className="p-4 bg-amber-50 rounded-full text-amber-600 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900 mb-2">Barcode Not Recognized</h1>
        <p className="text-sm text-neutral-600 mb-4">
          The code <code className="bg-neutral-100 px-1.5 py-0.5 rounded font-mono font-bold">{code}</code> does not match any item in inventory.
        </p>
        <a href="/" className="text-sm font-medium text-amber-700 hover:underline">
          Return to Home
        </a>
      </div>
    );
  }

  // Redirect to the inventory item detail page within its property context
  redirect(`/properties/${item.property_id}/inventory/${item.id}`);
}
