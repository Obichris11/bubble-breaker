import type { Routes } from '@angular/router';
import { STRINGS } from './strings';
import { AboutScreen } from './ui/screens/about-screen';
import { GameScreen } from './ui/screens/game-screen';
import { HowToPlayScreen } from './ui/screens/how-to-play-screen';
import { OptionsScreen } from './ui/screens/options-screen';
import { scoringGuard } from './ui/screens/scoring-guard';
import { ScoringScreen } from './ui/screens/scoring-screen';
import { StatisticsScreen } from './ui/screens/statistics-screen';

/** ADR-0006: eager routes; the menu, dialogs and toasts are overlays, not routes. */
export const routes: Routes = [
  { path: '', component: GameScreen, title: STRINGS.appTitle },
  {
    path: 'scoring',
    component: ScoringScreen,
    canActivate: [scoringGuard],
    title: STRINGS.pageTitle(STRINGS.scoring.title),
  },
  {
    path: 'statistics',
    component: StatisticsScreen,
    title: STRINGS.pageTitle(STRINGS.stats.title),
  },
  { path: 'options', component: OptionsScreen, title: STRINGS.pageTitle(STRINGS.options.title) },
  {
    path: 'how-to-play',
    component: HowToPlayScreen,
    title: STRINGS.pageTitle(STRINGS.howToPlay.title),
  },
  { path: 'about', component: AboutScreen, title: STRINGS.pageTitle(STRINGS.about.title) },
  { path: '**', redirectTo: '' },
];
