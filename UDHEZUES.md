# Testing Manager - Udhëzues i Përdorimit

## 🎯 Përmbledhje

Sistem i plotë për menaxhimin e mjediseve të testimit dhe shpërndarjen automatike të work items.

## 🔑 Kredencialet Fillestare

**Admin:**
- Email: `admin@example.com`
- Password: `Solab-123`

## 📋 Funksionalitetet Kryesore

### Për Adminët:

#### 1. Menaxhimi i Userëve
- Shto userë të rinj (Admin ose User)
- Përcakto: Emër, Mbiemër, Email, Password, Emër Ekipi
- Edito dhe fshi userë ekzistues

#### 2. Menaxhimi i Mikroserviseve
- Shto mikroservise të reja (p.sh. Front, Backend, API Gateway)
- Edito dhe fshi mikroservise
- Mikroserviset janë dinamike dhe mund të shtohen në çdo kohë

#### 3. Menaxhimi i Mjediseve
- Shto mjedise të testimit (p.sh. QA, Nightly, UAT)
- Shëno nëse është "Second Environment" (për Front only)
- Edito dhe fshi mjedise

#### 4. Konfigurimi i Ekipeve
- Përcakto anëtarët e ekipeve që mund të punojnë së bashku
- Konfiguro temporary branches support
- Mbaj mend konfigurimet për përdorim të ardhshëm

#### 5. Shikimi i Work Items
- Shiko të gjitha work items e krijuara nga të gjithë userët
- Filtro sipas datës
- Fshi work items nëse është e nevojshme

#### 6. Gjenerimi i Shpërndarjes
- Gjenero automatikisht listën e testing sessions
- Shpërndarja bazohet në rregulla komplekse:
  - Nuk lejon konflikte mes ekipeve të ndryshme
  - Ekipe të njëjta mund të kenë konflikte (temporary branches)
  - "Second" environments vetëm për Front only ose ekipe të njëjta
  - Optimizon përdorimin e mjediseve

### Për Userët:

#### 1. Shtimi i Work Items
- Vendos emrin e work item (p.sh. Feature-123)
- **Zgjedh Priority** (1=Kritik, 2=I lartë, 3=Mesatar, 4=I ulët) - MANDATORY
- Zgjedh mikroserviset e nevojshme (Po/Jo për secilin)
- Opsionale: Specifiko environment
- Përcakto nëse mund të bëhet temp branch me ekipin

#### 2. Menaxhimi i Work Items
- Edito work items ekzistuese
- Fshi work items që nuk janë më të nevojshme
- Shiko historikun e punës tënde

## 🎨 Veçoritë e UI

- **Dizajn modern** me gradiente të lehta dhe ngjyra të pastra
- **Responsive** - funksionon në të gjitha pajisjet
- **Intuitiv** - navigim i thjeshtë dhe i qartë
- **Toast notifications** - feedback i menjëhershëm për çdo veprim
- **Tabs për Admin** - organizim i qartë i funksionaliteteve

## 🔄 Workflow i Përditshëm

1. **Mëngjesi:**
   - Userët logohen dhe shtojnë work items për ditën
   - Zgjedhin mikroserviset që u duhen

2. **Pas shtimit të të gjithë work items:**
   - Admini logohet dhe shikon të gjitha work items
   - Klikon "Gjenero Listen" për shpërndarjen automatike
   - Sistemi gjeneron listën e optimizuar të testing sessions

3. **Rezultati:**
   - Çdo user sheh në cilin environment duhet të testojë
   - Konfliktet janë të zgjidhura automatikisht
   - Temporary branches janë të konfiguruar ku është e nevojshme

## 📊 Logjika e Shpërndarjes

Sistemi ndjek këto rregulla në këtë renditje:

1. **Prioritet 1:** Shpërndaj në mjedise të lira (pa konflikte)
2. **Prioritet 2:** Ekipe të njëjta me konflikte → Temporary branches
3. **Prioritet 3:** Front only → Second environments
4. **Prioritet 4:** Optimizo bazuar në ngarkesën e mjediseve
5. **Rregull i hekurt:** ASNJË konflikt mes ekipeve të ndryshme

## 🗄️ Të Dhëna Fillestare

Sistemi vjen me këto të dhëna të para-konfiguruar:

**Mikroservise:** Front, Backend, API Gateway, Database Service, Auth Service, Payment Service, Notification Service, Analytics Service, Report Service, Integration Service, Cache Service, Queue Service, Storage Service, Search Service, Email Service, SMS Service

**Mjedise:** QA, Nightly, Weekly, UAT, Smoke, Beta, QC, QA-second, Nightly-second, Weekly-second

## 🛠️ Teknologjitë e Përdorura

- **Backend:** FastAPI + Python
- **Database:** MongoDB
- **Frontend:** React + Shadcn UI
- **Styling:** Tailwind CSS
- **Autentifikimi:** Token-based

## 📝 Shënime të Rëndësishme

- Të gjitha të dhënat ruhen për çdo ditë
- Historia e work items mbahet si log
- Shpërndarja gjenerohet nga zero çdo ditë
- Admini dhe Useri mund të editojnë të dhënat e tyre
- Sistemi mbështet një numër të pakufizuar mikroservisesh dhe mjedisesh
