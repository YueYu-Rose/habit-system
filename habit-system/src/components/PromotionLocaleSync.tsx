import { useEffect, useRef } from "react";
import { useAppConfig } from "../config/appConfig";
import { useHabitToast } from "../context/HabitToastContext";
import { useLanguage } from "../context/LanguageContext";
import { resetPromotionMockData, syncPromotionLocaleOnLangChange } from "../lib/mockStorage";

/**
 * 推广版：语言切换时同步未改动的模板数据；挂载 window 重置方法。
 */
export function PromotionLocaleSync() {
  const { isPromotionOffline } = useAppConfig();
  const { lang, t } = useLanguage();
  const { toast } = useHabitToast();
  const firstMount = useRef(true);

  useEffect(() => {
    if (!isPromotionOffline) return;
    (window as unknown as { __habitResetPromoData?: (l?: "zh" | "en") => void }).__habitResetPromoData = (l) => {
      resetPromotionMockData(l);
    };
    return () => {
      const w = window as unknown as { __habitResetPromoData?: unknown };
      delete w.__habitResetPromoData;
    };
  }, [isPromotionOffline]);

  useEffect(() => {
    if (!isPromotionOffline) return;
    const r = syncPromotionLocaleOnLangChange(lang);
    if (r === "synced" && !firstMount.current) {
      toast({ title: t("promo.syncLocale"), points: 0, tone: "default", durationMs: 3200 });
    }
    firstMount.current = false;
  }, [isPromotionOffline, lang, t, toast]);

  return null;
}
