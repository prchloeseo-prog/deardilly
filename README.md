# Dear Dilly 운영 대시보드

## 배포 방법 (Vercel)

### 1. GitHub에 올리기
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR_ID/deardilly-ops.git
git push -u origin main
```

### 2. Vercel 연결
1. https://vercel.com 접속 → New Project
2. GitHub 저장소 선택
3. Framework Preset: **Vite** 자동 감지됨
4. **Environment Variables** 추가:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (Anthropic 콘솔에서 발급)
5. Deploy 클릭

### 3. 로컬 개발
```bash
npm install
npm run dev
```

## 기능
- 📊 대시보드: 전체 KPI, 채널별 성과, 마진율
- 🏪 채널 비교: 쿠팡 / 스마트스토어 / 카페24 나란히 비교
- 📦 상품 관리: 원가·판매가·채널별 순마진 관리
- 📁 데이터 업로드: Excel/CSV 드래그앤드롭 (매출·광고 자동 감지)
- 🧠 AI 전략: 채널별 맞춤 전략 자동 생성
