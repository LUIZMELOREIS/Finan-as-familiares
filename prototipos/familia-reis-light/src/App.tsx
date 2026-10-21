import { useState } from 'react'
import { BottomNav, type Aba } from './components/BottomNav'
import { HomeScreen } from './screens/HomeScreen'
import { StatementScreen } from './screens/StatementScreen'
import { SmartUploadScreen } from './screens/SmartUploadScreen'
import { MembersScreen } from './screens/MembersScreen'

/** ==== APP: troca de telas pela barra inferior ==== */
export default function App() {
  const [aba, setAba] = useState<Aba>('home')
  return (
    <div className="app">
      {aba === 'home' && <HomeScreen aoVerExtrato={() => setAba('extrato')} />}
      {aba === 'extrato' && <StatementScreen />}
      {aba === 'scanner' && <SmartUploadScreen aoSalvar={() => setAba('home')} />}
      {aba === 'membros' && <MembersScreen />}
      <BottomNav ativa={aba} aoMudar={setAba} />
    </div>
  )
}
