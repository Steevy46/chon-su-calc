# 촌수 계산기 (Chonsu Calculator)

나로부터 가족 관계를 이어 붙이면 **촌수**와 **호칭**을 계산해주는 웹 앱입니다.
React + Vite로 만들어졌고, 별도 설정 없이 Vercel에 바로 배포할 수 있습니다.

---

## 🚀 배포 방법 (비개발자용 · 터미널 불필요)

### 1단계 — GitHub에 코드 올리기

1. [github.com](https://github.com) 가입 후 로그인
2. 오른쪽 위 **+** → **New repository** 클릭
3. 저장소 이름 입력 (예: `chonsu-calculator`) → **Create repository**
4. 다음 화면에서 **uploading an existing file** 링크 클릭
5. 이 폴더 안의 **모든 파일과 폴더**를 드래그해서 업로드
   (단, `node_modules`와 `dist` 폴더가 보이면 올리지 마세요. 없으면 신경 안 써도 됩니다.)
6. 아래 **Commit changes** 버튼 클릭

> 올려야 할 것: `index.html`, `package.json`, `vite.config.js`,
> `.gitignore`, `src/` 폴더(안의 `App.jsx`, `main.jsx` 포함)

### 2단계 — Vercel에 연결하기

1. [vercel.com](https://vercel.com) 접속 → **Continue with GitHub** 로 가입/로그인
2. 대시보드에서 **Add New… → Project** 클릭
3. 방금 만든 GitHub 저장소 옆 **Import** 클릭
4. 설정 화면이 나오면 **아무것도 바꾸지 말고** 그대로 **Deploy** 클릭
   (Vercel이 Vite 프로젝트를 자동 인식합니다)
5. 1~2분 뒤 완료 → **Visit** 버튼을 누르면 내 사이트 주소가 열립니다 🎉

생성된 주소(예: `https://chonsu-calculator.vercel.app`)를 누구에게나 공유할 수 있습니다.

---

## 🔧 나중에 수정하고 싶을 때

GitHub에서 `src/App.jsx` 파일을 열고 연필 아이콘으로 수정 후 저장하면,
Vercel이 **자동으로 다시 배포**합니다. (몇 초~1분 소요)

---

## 💻 (선택) 내 컴퓨터에서 미리 보기

Node.js가 설치된 경우:

```bash
npm install
npm run dev
```

브라우저에서 표시되는 주소(보통 http://localhost:5173)로 접속하면 됩니다.

---

## 빌드 정보 (Vercel 자동 인식)

- Build Command: `vite build`
- Output Directory: `dist`
- Framework Preset: Vite
