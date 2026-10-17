import { Link } from 'react-router-dom'
import type { Config, Usuario, Versiculo } from '../../tipos'
import { saudacao } from '../../util/formato'
import { Avatar } from './Avatar'

/**
 * Capa da tela inicial: foto da família (largura total com degradê), ou brasão
 * centralizado, ou o brasão padrão do app. Nome da família, lema, versículo do dia e saudação.
 */
export function Capa({ config, usuario, versiculo }: { config: Config; usuario: Usuario; versiculo?: Versiculo | null }) {
  const brasaoPadrao = import.meta.env.BASE_URL + 'brasao.svg'
  const temFoto = !!config.url_foto_capa
  const brasao = config.url_brasao || brasaoPadrao
  const nome = config.sobrenome ? `Família ${config.sobrenome}` : config.nome_familia || 'Nossa Família'

  return (
    <section className="relative overflow-hidden bg-app" aria-label="Capa da família">
      {temFoto && (
        <>
          <img src={config.url_foto_capa} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-painel" />
        </>
      )}
      <div className="relative max-w-3xl mx-auto px-4 pt-3 pb-5 area-segura-topo">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar usuario={usuario} tamanho={44} />
            <div>
              <div className="font-semibold leading-tight">{saudacao(usuario.apelido)}</div>
              <div className="text-sm text-suave">{usuario.perfil}</div>
            </div>
          </div>
          <Link to="/configuracoes" className="botao botao-fantasma !px-2" aria-label="Configurações">
            <span className="text-2xl" aria-hidden>⚙️</span>
          </Link>
        </div>

        <div className={`flex flex-col items-center text-center ${temFoto ? 'mt-14' : 'mt-4'}`}>
          {!temFoto && <img src={brasao} alt={`Brasão da ${nome}`} className="w-28 h-28 object-contain drop-shadow-lg" />}
          <h1 className="text-2xl font-extrabold mt-2 drop-shadow">{nome}</h1>
          {config.versiculo_lema && <p className="text-sm text-suave mt-1 italic max-w-sm">{config.versiculo_lema}</p>}
          {config.fe_ativa && versiculo && (
            <blockquote className="mt-3 card px-4 py-3 text-sm max-w-md bg-card/80 backdrop-blur">
              <p className="leading-snug">“{versiculo.texto}”</p>
              <footer className="text-suave mt-1 font-medium">— {versiculo.referencia}</footer>
            </blockquote>
          )}
        </div>
      </div>
    </section>
  )
}
