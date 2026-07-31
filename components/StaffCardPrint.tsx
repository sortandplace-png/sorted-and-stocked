// components/StaffCardPrint.tsx
// SS-411 follow-on (31 Jul): the printable staff card. Content authored and
// approved via the coordinating session (Drive: STAFF-CARD-PRINTABLE.md),
// bilingual with SPANISH FIRST throughout -- staff read the Spanish, the
// English is the reference line. Rendered as an in-app page under the Staff
// Handbook rather than a PDF in Drive, so it can never drift from the app
// the way the Drive handbook did (SS-144).
//
// Both languages print side by side on ONE card on purpose -- a printed
// sheet has no locale toggle. The app chrome (header, navs, footer, back
// bar) is already print:hidden, so window.print() emits just the card.
'use client';

import { Printer } from 'lucide-react';

const DOT = 'inline-block w-3 h-3 rounded-full align-middle mr-1.5 [print-color-adjust:exact]';

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-denim border-b border-cardBorder pb-1 mb-2.5">
        {n} · {title}
      </h2>
      {children}
    </section>
  );
}

function Pair({ es, en, strong }: { es: string; en: string; strong?: boolean }) {
  return (
    <p className={`mb-1.5 text-[13px] leading-snug ${strong ? 'font-semibold text-denim' : 'text-denim'}`}>
      {es} <span className="text-dusk">· {en}</span>
    </p>
  );
}

function Sub({ es, en }: { es: string; en: string }) {
  return (
    <h3 className="text-[12px] font-semibold text-denim mt-3 mb-1">
      {es} <span className="font-normal text-dusk">· {en}</span>
    </h3>
  );
}

export default function StaffCardPrint() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 print:py-0 print:px-0 print:max-w-none">
      <div className="print:hidden flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-display text-denim">Tarjeta del Personal · Staff Card</h1>
          <p className="text-sm text-dusk">
            Una página, imprimir por ambos lados · One page, print double-sided. Doble por la mitad para bolsillo ·
            Fold in half for a pocket card.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="shrink-0 inline-flex items-center gap-1.5 py-2 px-4 rounded-full bg-denim text-white text-sm font-medium"
        >
          <Printer size={14} strokeWidth={1.75} aria-hidden="true" />
          Imprimir · Print
        </button>
      </div>

      <div className="bg-card border border-cardBorder rounded-xl2 shadow-card p-5 print:border-0 print:shadow-none print:rounded-none print:p-0 md:columns-2 print:columns-2 gap-8">
        <div className="mb-4 break-inside-avoid">
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-dusk">
            Sorted &amp; Stocked — Sort + Place
          </p>
          <h2 className="font-display text-xl text-denim leading-tight">
            Tarjeta del Personal <span className="text-dusk">· Staff Card</span>
          </h2>
          <p className="text-[11px] text-dusk italic mt-0.5">
            Para un primer turno, o para quien no tenga la aplicación abierta · For a first shift, or for anyone
            without the app open.
          </p>
        </div>

        <Section n="1" title="Al llegar — When you arrive">
          <Pair strong es="Abra la aplicación → Personal → Mi Día" en="Open the app → Staff → My Day" />
          <Pair es="Ahí están sus tareas de hoy." en="Your tasks for today are there." />
          <Pair strong es="Después lea la Entrega de Turno." en="Then read the Shift Handover." />
          <Pair
            es="Dice qué se hizo, qué está en proceso, y qué debe saber. Las prioridades cambian de un día a otro."
            en="It says what was done, what's in progress, and what you should know. Priorities change day to day."
          />
        </Section>

        <Section n="2" title="Durante el turno — During your shift">
          <Sub es="Si no sabe dónde va algo" en="If you don't know where something goes" />
          <Pair es="1. Busque el nombre en Inventario" en="Search the name in Inventory" />
          <Pair es="2. Revise el Manual del Hogar" en="Check the House Manual" />
          <Pair es="3. Solo entonces pregunte" en="Only then ask" />
          <Sub es="Si algo está fuera de lugar" en="If something is out of place" />
          <Pair
            es="Cámbielo en la aplicación si tiene permiso. Si no, deje una nota en el artículo."
            en="Change it in the app if you have permission. If not, leave a note on the item."
          />
          <Sub es="Si algo se acabó" en="If something ran out" />
          <Pair strong es="No deje envases vacíos en el estante." en="Don't leave empty containers on the shelf." />
          <Pair
            es="Márquelo agotado o mándelo a la lista de compras de inmediato, no al final del día."
            en="Mark it out of stock or send it to the shopping list right away, not at the end of the day."
          />
          <Sub es="Cada tarea muestra sus materiales" en="Every task shows its supplies" />
          <Pair
            es="Abra la tarea. Los productos que necesita aparecen abajo, con una nota."
            en="Open the task. The supplies you need are listed underneath, with a note."
          />
        </Section>

        <Section n="3" title="Al terminar — When you finish">
          <Sub es="Si no puede terminar una tarea" en="If you can't finish a task" />
          <Pair
            strong
            es="No la deje en blanco."
            en="Don't leave it blank."
          />
          <Pair
            es="Actualice el estado y escriba una línea — falta un producto, o el cuarto estaba ocupado."
            en="Update the status and write one line — waiting on a supply, or the room was in use."
          />
          <Pair
            es="La siguiente persona necesita saber cómo quedó."
            en="The next person needs to know where it stands."
          />
          <Sub es="Si termina antes de tiempo" en="If you finish early" />
          <Pair es="Regrese a Mi Día. Hay prioridades secundarias." en="Go back to My Day. There are secondary priorities." />
        </Section>

        <Section n="4" title="Cuatro cosas que registrar — Four things to log">
          <Pair es="Al momento, no al final del día." en="As they happen, not at the end of the day." />
          <ol className="list-decimal ml-5 space-y-1 text-[13px] text-denim">
            <li>
              Artículos movidos — actualice el lugar <span className="text-dusk">· Items moved — update the location</span>
            </li>
            <li>
              Productos usados — avise qué se acaba <span className="text-dusk">· Supplies used — flag what's running low</span>
            </li>
            <li>
              Tareas terminadas — márquelas al momento <span className="text-dusk">· Tasks done — mark them at the time</span>
            </li>
            <li>
              Notas de la casa — lo que la familia deba saber{' '}
              <span className="text-dusk">· Household notes — anything the family should know</span>
            </li>
          </ol>
        </Section>

        <Section n="5" title="La regla más importante — The most important rule">
          <p className="text-[15px] font-display text-denim mb-1">
            Use la aplicación, no mensajes de texto. <span className="text-dusk">· Use the app, not text messages.</span>
          </p>
          <Pair
            es="Un mensaje se queda en un teléfono y se pierde. Lo que registra en la aplicación lo encuentra todo el equipo, siempre."
            en="A text sits in one phone and disappears. What you log in the app, the whole team can find, always."
          />
        </Section>

        <Section n="6" title="Kashrus en la cocina — Kashrus in the kitchen">
          <Pair strong es="Los paños y esponjas tienen color" en="Cloths and sponges are colour-coded" />
          <ul className="space-y-1 text-[13px] text-denim mb-2">
            <li>
              <span className={`${DOT} bg-red-600`} aria-hidden="true" />
              <strong>ROJO · RED</strong> — Carne <span className="text-dusk">· Meat</span>
            </li>
            <li>
              <span className={`${DOT} bg-blue-600`} aria-hidden="true" />
              <strong>AZUL · BLUE</strong> — Lácteo <span className="text-dusk">· Dairy</span>
            </li>
            <li>
              <span className={`${DOT} bg-green-600`} aria-hidden="true" />
              <strong>VERDE · GREEN</strong> — Parve <span className="text-dusk">· Pareve</span>
            </li>
            <li>
              <span className={`${DOT} border border-denim bg-card`} aria-hidden="true" />
              <strong>ETIQUETA · STICKER</strong> — Pésaj <span className="text-dusk">· Pesach</span>
            </li>
          </ul>
          <Pair strong es="Nunca use uno en la superficie equivocada." en="Never use one on the wrong surface." />
          <Pair es="Si no está seguro, pregunte. Nunca adivine." en="If you are not sure, ask. Never guess." />
        </Section>

        <div className="break-inside-avoid border-t border-cardBorder pt-2">
          <Pair strong es="¿Preguntas?" en="Questions?" />
          <Pair es="Manual del Hogar en la aplicación" en="House Manual in the app" />
          <p className="text-[13px] text-denim">Sort + Place · (718) 938-4342</p>
        </div>
      </div>
    </div>
  );
}
