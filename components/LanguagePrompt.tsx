"use client";

import { AppLanguage, t } from "@/lib/i18n";

interface LanguagePromptProps {
  language: AppLanguage;
  onChoose: (language: AppLanguage) => void;
}

export function LanguagePrompt({ language, onChoose }: LanguagePromptProps): React.JSX.Element {
  return (
    <div className="language-prompt-overlay" role="dialog" aria-modal="true" aria-label={t(language, "chooseLanguage")}>
      <div className="language-prompt-card">
        <h2>{t(language, "chooseLanguage")}</h2>
        <div className="language-prompt-actions">
          <button type="button" onClick={() => onChoose("en")}>
            {t(language, "english")}
          </button>
          <button type="button" onClick={() => onChoose("ne")}>
            {t(language, "nepali")}
          </button>
        </div>
      </div>
    </div>
  );
}
