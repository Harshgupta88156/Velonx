"use client";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { messages } from "@/messages";
import type { Locale } from "@/lib/types";
import CommandCentre from "@/components/command-centre";
export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      timeZone="Asia/Kolkata"
    >
      <CommandCentre locale={locale} setLocale={setLocale} />
    </NextIntlClientProvider>
  );
}
