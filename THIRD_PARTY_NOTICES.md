# Third-party notices

## Workout.cool muscle illustration

SetFlow includes adapted SVG muscle-selection components from the
Workout.cool project:

- Source: https://github.com/Snouzy/workout-cool
- Baseline commit inspected: e3dcd23b4ebdfb6254010b9a7c350cfef9e236c8
- Original files:
  - `src/features/workout-builder/ui/muscle-selection.tsx`
  - `src/features/workout-builder/ui/muscles/*.tsx`
- SetFlow adaptation:
  - Replaced Workout.cool app dependencies with SetFlow local types.
  - Rethemed SVG fill, hover, selected, and disabled states with SetFlow CSS tokens.
  - Mapped Workout.cool detailed muscle ids to SetFlow's current exercise groups.

MIT License

Copyright (c) 2023 Mathias Bradiceanu

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Pull-up exercise demonstration video

SetFlow's `正握引体向上` preview sample includes a locally bundled copy and
poster frame of the following Wikimedia Commons video:

- Work: `Pull-ups - exercise demonstration video.webm`
- Author and required attribution: FitnessScape
- Source: https://commons.wikimedia.org/wiki/File:Pull-ups_-_exercise_demonstration_video.webm
- License: Creative Commons Attribution 3.0 Unported
- License URL: https://creativecommons.org/licenses/by/3.0/
- SetFlow changes: the source video is bundled without editing and displayed
  inside SetFlow's 16:9 preview frame; the poster is Wikimedia's generated
  preview image. No audio was present in the source file.
- Video SHA-256: `1DDF02C690C6DA9D27C9CA50453D2DF212D777BB402203AF116B70BF27A2227D`
- Poster SHA-256: `BC2AC175E777EF0A12AAA0FC0DA60782DCFE6C638C3092C846443C153A5FF954`
