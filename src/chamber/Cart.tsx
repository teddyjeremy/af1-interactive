import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import type { CartLine } from "./cart";
import { money, pairPrice } from "./pricing";
import type { Design } from "./presets";
import { useChamber } from "./store";

const ACCENTS = ["AF1_Quarter", "AF1_Swoosh", "AF1_ToeBox", "AF1_Midsole", "AF1_Laces"] as const;

function accents(design: Design) {
  return [...new Set(ACCENTS.map((id) => design.parts[id].color))];
}

function lineTotal(line: CartLine) {
  return pairPrice(line.design, line.prints, line.size) * line.qty;
}

export function Cart() {
  const open = useChamber((s) => s.cartOpen);
  const cart = useChamber((s) => s.cart);
  const order = useChamber((s) => s.order);
  const [step, setStep] = useState<"bag" | "details">("bag");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const count = cart.reduce((sum, line) => sum + line.qty, 0);
  const total = cart.reduce((sum, line) => sum + lineTotal(line), 0);

  function close() {
    useChamber.getState().setCartOpen(false);
  }

  function submit() {
    const buyer = name.trim();
    if (buyer.length < 2) {
      setError("Enter your name to save this design.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email to save this design.");
      return;
    }
    setError(null);
    useChamber.getState().placeStudy(buyer, total);
    setStep("bag");
    setNote("");
  }

  return (
    <aside className="cart" role="dialog" aria-label="Your bag">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="inst-label">Your bag</p>
          <h2 className="mt-1 font-display text-xl italic leading-none text-bone">
            {order ? "Saved" : count ? `${count} ${count === 1 ? "pair" : "pairs"}` : "Your bag is empty"}
          </h2>
        </div>
        <button type="button" className="icon-btn" aria-label="Close cart" onClick={close}>
          <X />
        </button>
      </div>

      {order ? (
        <div>
          <p className="font-mono text-sm text-heat">{order.code}</p>
          <p className="mt-3 text-sm leading-relaxed text-bone">
            Design saved for {order.buyer}. {order.count} {order.count === 1 ? "pair" : "pairs"}, {money(order.total)}.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-steel">
            Demo checkout only — no payment was taken. Your saved note stays in this session.
          </p>
          {note.trim() && <p className="mt-3 font-mono text-xs text-bone">“{note.trim()}”</p>}
          <button
            type="button"
            className="mode-btn mode-btn-on mt-5"
            onClick={() => {
              setNote("");
              useChamber.getState().clearOrder();
            }}
          >
            Back to customizing
          </button>
        </div>
      ) : step === "details" ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <p className="text-sm leading-relaxed text-steel">
            {money(total)} across {count} {count === 1 ? "pair" : "pairs"}. Demo checkout only — no payment is taken.
          </p>
          <label className="inst-label">
            Name
            <input className="field mt-1" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          </label>
          <label className="inst-label">
            Email
            <input
              className="field mt-1"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="inst-label">
            Note
            <textarea className="field field-area mt-1" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </label>
          {error && (
            <p className="font-mono text-xs text-heat" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="mode-btn mode-btn-on">
              Save my design
            </button>
            <button type="button" className="mode-btn" onClick={() => setStep("bag")}>
              Back
            </button>
          </div>
        </form>
      ) : cart.length === 0 ? (
        <p className="text-sm leading-relaxed text-steel">
          Your next pair starts here. Choose a colourway, make it yours, then add it to your bag. Your total updates as you customize.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {cart.map((line) => (
              <li key={line.id} className="border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-bone">
                      {line.name}, US {line.size}
                    </p>
                    <p className="mt-1 text-xs text-steel">
                      {line.prints ? "Prints on" : "No prints"}, US {line.size}, {money(pairPrice(line.design, line.prints, line.size))}
                    </p>
                  </div>
                  <p className="font-mono text-sm text-heat">{money(lineTotal(line))}</p>
                </div>
                <div className="mt-2 flex gap-1">
                  {accents(line.design).map((color) => (
                    <span key={color} className="swatch" style={{ background: color }} />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Fewer ${line.name}`}
                    onClick={() => useChamber.getState().setQty(line.id, line.qty - 1)}
                  >
                    <Minus />
                  </button>
                  <span className="min-w-6 text-center font-mono text-sm">{line.qty}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`More ${line.name}`}
                    onClick={() => useChamber.getState().setQty(line.id, line.qty + 1)}
                  >
                    <Plus />
                  </button>
                  <button type="button" className="chip" onClick={() => useChamber.getState().removeLine(line.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="inst-label">Your total</p>
            <p className="font-mono text-sm text-bone">{money(total)}</p>
          </div>
          <button type="button" className="mode-btn mode-btn-on" onClick={() => setStep("details")}>
            Checkout
          </button>
          <p className="font-mono text-xs leading-relaxed text-steel">
            Demo checkout only. Your selection is saved for this session; no payment is taken.
          </p>
        </div>
      )}
    </aside>
  );
}
