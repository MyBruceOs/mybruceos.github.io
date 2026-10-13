# TRENDLY — film motion design (15 s)

Film de lancement de 15 secondes pour TRENDLY, codé en React avec
[Remotion](https://www.remotion.dev/). Deux formats sortent du même code :

| Composition     | Format      | Usage                    | Fichiers rendus                                              |
| --------------- | ----------- | ------------------------ | ------------------------------------------------------------ |
| `Trendly-16x9`  | 1920 × 1080 | landing page             | `out/trendly-16x9.mp4` (master), `out/trendly-16x9-web.mp4` (≈ 6 Mo), `out/trendly-16x9-poster.jpg` |
| `Trendly-9x16`  | 1080 × 1920 | TikTok / Reels / Shorts  | `out/trendly-9x16.mp4`, `out/trendly-9x16-poster.jpg`        |

60 i/s, 900 images, 15,000 s exactement (vidéo, audio et conteneur), H.264
yuv420p BT.709 + AAC 256 kb/s, bande-son à environ −14 LUFS.

## Déroulé

| Temps        | Scène                                                                                   |
| ------------ | --------------------------------------------------------------------------------------- |
| 0 – 2,2 s    | Mur 3D infini de vidéos mode qui défile. « Des milliers de vidéos mode. Lesquelles décollent ? » Match-cut sur l'écran du feed. |
| 2,2 – 4,2 s  | Le téléphone se forme autour de l'écran. Swipe vertical (flou de mouvement) de CROISSANCE vers VIRAL. |
| 4,2 – 6,3 s  | Courbe de croissance exponentielle : ÉMERGENT → CROISSANCE → VIRAL.                   |
| 6,3 – 10,1 s | Tap sur « Voir l'analyse », puis la fiche s'ouvre : score TRENDLY 75/100, métriques en vue éclatée 3D, « Pourquoi ce score ? ». |
| 10,1 – 12,5 s| « Sauvegarder » : la vidéo s'envole vers la grille « Sauvegardées ».                   |
| 12,5 – 15 s  | Les vignettes s'engouffrent en vortex dans l'icône, le T s'allume façon néon, la flèche jaillit, puis le wordmark et la signature apparaissent. |

Toutes les interfaces sont reconstruites en React (et non en captures) à partir
des écrans du MVP : feed, pastilles de statut, fiche analyse, onglet
Sauvegardées. Le texte reste net à toutes les tailles.

## Intégration sur la landing page

```html
<video
  src="trendly-16x9-web.mp4"
  poster="trendly-16x9-poster.jpg"
  autoplay muted loop playsinline preload="metadata"
  style="width:100%;height:auto;border-radius:24px;background:#060608">
</video>
```

`autoplay` ne fonctionne qu'avec `muted` : la bande-son sert à TikTok et aux
lectures avec le son. Le poster est la dernière image (logo + signature).

## Lancer, prévisualiser, rendre

```bash
npm install
npm run studio          # prévisualisation interactive (Remotion Studio)
npm run render:16x9     # → out/trendly-16x9.mp4 (+ -web.mp4, poster)
npm run render:9x16     # → out/trendly-9x16.mp4 (+ poster)
```

Chaque commande rend d'abord avec Remotion dans `out/raw/`, puis
`scripts/finalize.sh` (ffmpeg) produit les fichiers livrés : conversion en
BT.709 plage limitée (Remotion écrit en BT.601 plage pleine), audio
réencodé depuis le WAV et coupé à 15,000 s, `faststart` pour le web, version
web allégée et poster.

Planche de contrôle de l'UI : `npx remotion still UiSheet out/uisheet.png`.
Images clés pour la revue : `node scripts/stills.mjs Trendly-16x9 out/stills 0 132 300 …`.

## Modifier le film

| Je veux changer…                        | Fichier                                                         |
| --------------------------------------- | --------------------------------------------------------------- |
| Les textes, chiffres, pseudos, la grille | `src/data.ts`                                                  |
| Le minutage d'une scène                 | `src/timeline.ts` (`T` + trajectoires caméra du téléphone)       |
| Les couleurs, polices                   | `src/theme.ts`                                                  |
| Une scène                               | `src/scenes/*.tsx` (`Hook`, `PhoneStory`, `Statuses`, `Finale`) |
| Un écran de l'app                       | `src/ui/*.tsx` (`Feed`, `Analysis`, `Saved`, `Phone`, `LogoIcon`) |
| Les visuels mode                        | `public/media/*.jpg` (mêmes noms), ou `scripts/prepare_assets.py` |
| La bande-son                            | `scripts/sound_design.py` (régénère `public/audio/trendly-sound.wav`) |

Si vous changez le minutage dans `src/timeline.ts`, reportez les mêmes images
dans le dict `T` en tête de `scripts/sound_design.py`, puis relancez-le : les
effets sonores sont calés à l'image près.

### Visuels

`scripts/prepare_assets.py` extrait les looks mode des captures du MVP
(`assets-src/`) : il retire l'UI incrustée (inpainting OpenCV), recadre au format
du feed, agrandit l'image et génère les variantes floutées (verre dépoli), noir
et blanc et duotone rose.

```bash
pip install opencv-contrib-python-headless numpy pillow scipy
python scripts/prepare_assets.py
python scripts/sound_design.py
```

`jeans.jpg` provient d'une petite vignette (274 × 301 px) : il n'est utilisé
qu'en petites tuiles, avec des cadrages qui évitent la zone reconstruite.

## Droits et licences

- **Visuels mode** : ils proviennent des captures du MVP. Avant toute diffusion
  publicitaire, vérifiez que vous avez l'accord des créatrices (pseudos et
  vidéos TikTok) ou remplacez les fichiers de `public/media/`.
- **Remotion** : gratuit pour les particuliers et les entreprises de 3 salariés
  au plus. Au-delà, une licence entreprise est requise
  ([remotion.pro](https://www.remotion.pro/license)).
- **Polices** : Inter et Montserrat (SIL OFL), Noto Color Emoji (SIL OFL, voir
  `public/fonts/NOTO-EMOJI-LICENSE.txt`).
- **Son** : entièrement synthétisé par `scripts/sound_design.py` (aucun sample).
