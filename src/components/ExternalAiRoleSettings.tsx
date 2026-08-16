import { useEffect, useState } from 'react';
import type { Locale } from '../i18n/translations';
import type { AiConnectionProfileV1 } from '../types/aiProvider';
import { capabilityBudgetWarning } from '../services/ai/commandOutput';
import {
  loadAiRoleProfileSelection,
  saveAiRoleProfileSelection,
} from '../services/aiProviderProfiles';

interface ExternalAiRoleSettingsProps {
  profiles: AiConnectionProfileV1[];
  activeProfile: AiConnectionProfileV1 | null;
  locale: Locale;
}

export const ExternalAiRoleSettings = ({ profiles, activeProfile, locale }: ExternalAiRoleSettingsProps) => {
  const [selection, setSelection] = useState(() => loadAiRoleProfileSelection(profiles));
  const warning = capabilityBudgetWarning(activeProfile?.capabilities ?? null);
  useEffect(() => saveAiRoleProfileSelection(selection, profiles), [profiles, selection]);
  return (
    <>
      <div className="local-ai-grid">
        <label className="local-ai-field">
          <span>{locale === 'tr' ? 'Anlatı modeli' : 'Narrative model'}</span>
          <select className="api-provider-select" value={selection.narrativeProfileId ?? ''} onChange={(event) => setSelection((current) => ({ ...current, narrativeProfileId: event.target.value || null }))}>
            <option value="">{locale === 'tr' ? 'Seçilmedi' : 'Not selected'}</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.model || (locale === 'tr' ? 'model seçilmedi' : 'no model')}</option>)}
          </select>
        </label>
        <label className="local-ai-field">
          <span>{locale === 'tr' ? 'Komut modeli' : 'Command model'}</span>
          <select className="api-provider-select" value={selection.commandProfileId ?? ''} onChange={(event) => setSelection((current) => ({ ...current, commandProfileId: event.target.value || null }))}>
            <option value="">{locale === 'tr' ? 'Yalnızca deterministik' : 'Deterministic only'}</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.model || (locale === 'tr' ? 'model seçilmedi' : 'no model')}</option>)}
          </select>
        </label>
      </div>
      {!selection.commandProfileId && <p className="local-ai-note ai-status warning">{locale === 'tr' ? 'Komut modeli seçilmedi. Gezinme ve girdi düzenleme tamamen deterministik çalışır.' : 'No command model is selected. Navigation and input editing run deterministically.'}</p>}
      {activeProfile?.capabilities && (
        <div className="local-storage-status">
          <span className={activeProfile.capabilities.chat ? 'ready' : ''}>{locale === 'tr' ? 'Sohbet uyumlu' : 'Chat compatible'}</span>
          <span className={activeProfile.capabilities.advancedWorkflows ? 'ready' : ''}>{activeProfile.capabilities.advancedWorkflows ? (locale === 'tr' ? 'Gelişmiş akış uyumlu' : 'Advanced workflows compatible') : (locale === 'tr' ? 'Gelişmiş akış kullanılamıyor' : 'Advanced workflows unavailable')}</span>
          <span>{locale === 'tr' ? 'Şema' : 'Schema'}: {activeProfile.capabilities.structuredOutput}</span>
          <span>{locale === 'tr' ? 'Akıl yürütme yükü' : 'Reasoning overhead'}: ~{activeProfile.capabilities.reasoningOverhead}</span>
          <span className={activeProfile.capabilities.usableOutputTokens >= 250 ? 'ready' : ''}>{locale === 'tr' ? 'Kullanılabilir çıktı' : 'Usable output'}: {activeProfile.capabilities.usableOutputTokens}</span>
        </div>
      )}
      {warning && <p className="local-ai-note ai-status error">{locale === 'tr' ? `Bu model her cevapta yaklaşık ${activeProfile?.capabilities?.reasoningOverhead ?? 0} token akıl yürütüyor. Azami çıktıyı 2048'e çıkarın veya komutlar için akıl yürütmeyen bir model seçin.` : warning}</p>}
    </>
  );
};
