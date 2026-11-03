"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const install = async () => {
    if (!installEvent) {
      setMessage("On iPhone, use Share, then Add to Home Screen. On Android, open the browser menu and choose Install app.");
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setMessage(choice.outcome === "accepted" ? "Business Tracker was added to your home screen." : "Installation was cancelled.");
    setInstallEvent(null);
  };

  return (
    <section className="border-2 border-black p-5">
      <h2 className="text-xl font-semibold tracking-[-0.05em]">Web app on mobile homescreen</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Install Business Tracker as an app for quicker access on your phone.
      </p>
      <Button type="button" className="mt-4 w-full sm:w-auto" onClick={() => void install()}>
        Add to home screen
      </Button>
      {message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}
    </section>
  );
}
