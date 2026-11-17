import Image from "next/image";
import Link from "next/link";

import { Logo } from "@/components/zelo/logo";
import { ReceiptPreview } from "@/components/zelo/receipt-preview";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-4 py-5 md:px-10 md:py-8">
        <Link
          href="/"
          aria-label="Zelo, página inicial"
          className="self-start rounded-[var(--radius-control)]"
        >
          <Logo height={32} />
        </Link>
        <main className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-[25rem]">{children}</div>
        </main>
        <p className="text-support text-slate-600">Combinou? Registrou.</p>
      </div>

      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-teal-50 [clip-path:polygon(9rem_0,100%_0,100%_100%,0_100%)] lg:block"
      >
        <Image
          src="/brand/symbol.svg"
          alt=""
          width={640}
          height={640}
          unoptimized
          className="absolute -right-40 -bottom-40 size-[40rem] max-w-none"
        />
        <div className="relative flex h-full items-center justify-center py-16 pr-16 pl-40">
          <ReceiptPreview className="w-full max-w-[26rem]" />
        </div>
      </aside>
    </div>
  );
}
