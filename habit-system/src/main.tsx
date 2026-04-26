import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { HabitToastProvider } from "./context/HabitToastContext";
import { HabitUserProvider } from "./context/HabitUserContext";
import { MainlineLoopProvider } from "./context/MainlineLoopContext";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { appConfig } from "./config/appConfig";
import { ensureMockSeedForPromotion } from "./lib/mockStorage";
import { initHabitThemeOnLoad } from "./theme/habitTheme";
import { ThemeProvider } from "./theme/ThemeProvider";
import "./habit.css";

ensureMockSeedForPromotion();
initHabitThemeOnLoad(appConfig.mode);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <HabitUserProvider>
              <HabitToastProvider>
                <MainlineLoopProvider>
                  <App />
                </MainlineLoopProvider>
              </HabitToastProvider>
            </HabitUserProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
