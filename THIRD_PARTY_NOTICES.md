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

## RepDB exercise images

SetFlow includes 21 unchanged 512 px WebP exercise images from RepDB's
canonical free-tier dataset. They are used inside the app as start, peak, or
hold-position previews.

- Required attribution: Exercise data by RepDB (repdb.co)
- Source: https://github.com/sergei-argutin/exercise-dataset
- Snapshot commit: `045845b61e4aefd9e684fa84518b84c665ea3cd3`
- License: RepDB Free Tier License v1.0
- License text: https://github.com/sergei-argutin/exercise-dataset/blob/main/LICENSE-DATA.md
- SetFlow changes: files are bundled unchanged; related start and peak images
  are alternated in the interface to form a lightweight offline pose sequence.
- Included exercise asset groups: bird dog hold, bodyweight good morning,
  bodyweight squat, dead bug, incline push-up, inverted row, kettlebell
  deadlift, knee push-up, lunge, plank, push-up, and side plank.

The paid-tier preview animations in the RepDB repository are not included.

## Wall push-up demonstration

- Work: `Wallpushup-CDC strength training for older adults.gif`
- Author/source: U.S. Centers for Disease Control and Prevention
- Source: https://commons.wikimedia.org/wiki/File:Wallpushup-CDC_strength_training_for_older_adults.gif
- License: Public domain (work of the U.S. federal government)
- SetFlow changes: none; the original GIF is bundled unchanged.
- SHA-256: `42E90EDCBA8FD734573E6E876BF3192F5EE1B0BB8876FEA95DD7B3E23F0FC16C`

## Single-leg bridge photograph

- Work: `Single Leg Bridge.jpg`
- Author: Klewis425
- Source: https://commons.wikimedia.org/wiki/File:Single_Leg_Bridge.jpg
- License: Creative Commons Attribution-ShareAlike 3.0 Unported
- License URL: https://creativecommons.org/licenses/by-sa/3.0/
- SetFlow changes: none; the original image is bundled unchanged and displayed
  with `object-fit: contain`.
- SHA-256: `5BEC51A0C104AF9858E3535B66DFD8ABFB3213A249F9EC783542F3E63B104F92`

## Resistance-band row photograph

- Work: `Row with elastic band`
- Author: Strenght and Health Science
- Source: https://www.flickr.com/photos/146248579@N06/32827016027
- Discovery record: https://api.openverse.org/v1/images/858c0c64-510b-4e36-9033-6ceb08b70870/
- License: Creative Commons Attribution-NonCommercial-NoDerivatives 2.0
- License URL: https://creativecommons.org/licenses/by-nc-nd/2.0/
- SetFlow changes: none; the original two-position image is bundled unchanged
  and displayed with `object-fit: contain`.
- SHA-256: `7AA86350A87EA6EFDF8B9D3D3A8E4C611789C6FB97EEF94512E38358B22660CB`

## Dumbbell goblet squat photograph

- Exercise: `Dumbbell Goblet Squat` (wger exercise 203)
- Author: philip
- Source page: https://wger.de/api/v2/exerciseinfo/203/
- Original image: https://wger.de/media/exercise-images/203/1c052351-2af0-4227-aeb0-244008e4b0a8.jpeg
- License: Creative Commons Attribution-ShareAlike 4.0
- License URL: https://creativecommons.org/licenses/by-sa/4.0/
- SetFlow changes: none; the original two-position image is bundled unchanged
  and displayed with `object-fit: contain`.
- SHA-256: `BB75E5FCA543056DB51764B9648A0344CDFBE824CA2CE9C9A752D21D094BDEAD`
