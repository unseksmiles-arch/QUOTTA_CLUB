
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Fuel,
  LifeBuoy,
  LockKeyhole,
  ShieldCheck,
  Users,
  Waves,
} from 'lucide-react';

import styles from './home.module.css';

function Brand() {
  return (
    <Link
      href="/"
      className={styles.brand}
      aria-label="QUOTTA Club — início"
    >
      <span className={styles.brandMark} aria-hidden="true">
        <Waves size={34} strokeWidth={2.5} />
        <span className={styles.brandSun} />
      </span>

      <span className={styles.brandName}>
        QUOTTA <em>Club</em>
        <small>LIBERDADE COMPARTILHADA</small>
      </span>
    </Link>
  );
}

export default function Home() {
  return (
    <main className={styles.site}>

      {/* CABEÇALHO */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />

          <nav className={styles.nav} aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a>
            <a href="#veiculos">Nossos veículos</a>
            <a href="#valores">Valores</a>
          </nav>

          <div className={styles.headerActions}>
            <Link href="/login" className={styles.login}>
              <LockKeyhole size={20} />
              Entrar
            </Link>

            <a href="#valores" className={styles.goldButton}>
              Quero ser cotista
              <ArrowRight size={20} />
            </a>
          </div>
        </div>
      </header>

      {/* APRESENTAÇÃO PRINCIPAL */}
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroInner}>

          <div className={styles.heroText}>
            <span className={styles.eyebrow}>
              <Waves size={18} />
              QUOTTA CLUB • GUARAPARI, ES
            </span>

            <h1 id="hero-title">
              Mais que veículos.
              <br />
              <span>Experiências para você viver.</span>
            </h1>

            <p>
              Compartilhe momentos especiais no mar com conforto,
              organização e liberdade. Seu clube de cotas começa aqui.
            </p>

            <div className={styles.heroActions}>
              <a className={styles.goldButton} href="#valores">
                Quero ser cotista
                <ArrowRight size={21} />
              </a>

              <a className={styles.outlineButton} href="#como-funciona">
                Conheça o clube
              </a>
            </div>

            <p className={styles.heroHint}>
              <CheckCircle2 size={18} />
              8 cotas iguais • reservas organizadas • atendimento simples
            </p>
          </div>

          <div className={styles.heroPhoto}>
            <div className={styles.photoGlow} />

            <Image
              src="/seadoo-wake-pro-2026.jpg"
              alt="Sea-Doo Wake Pro 2026 bege e azul do QUOTTA Club"
              fill
              priority
              sizes="(max-width: 850px) 100vw, 55vw"
              className={styles.jetPhoto}
            />

            <span className={styles.photoLabel}>
              NOSSO PRIMEIRO BEM
              <strong>Sea-Doo Wake Pro · 2026</strong>
            </span>
          </div>

        </div>
      </section>

      {/* VEÍCULOS DO CLUBE */}
      <section id="veiculos" className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <span className={styles.kicker}>
              EXPERIÊNCIAS QUOTTA
            </span>

            <h2>Escolha como aproveitar</h2>

            <p>
              Hoje começamos com um Sea-Doo.
              Em breve, novas opções para o clube.
            </p>
          </div>
        </div>

        <div className={styles.vehicleGrid}>

          {/* JET SKI */}
          <article className={styles.vehicleFeatured}>
            <div className={styles.vehicleImage}>
              <Image
                src="/seadoo-wake-pro-2026.jpg"
                alt="Sea-Doo Wake Pro 2026 bege e azul"
                fill
                sizes="(max-width: 850px) 100vw, 50vw"
                style={{ objectFit: 'contain' }}
              />
            </div>

            <div className={styles.vehicleContent}>
              <span className={styles.available}>
                DISPONÍVEL
              </span>

              <h3>Sea-Doo Wake Pro 2026</h3>

              <p>
                Modelo 2026 · 8 cotas de 12,5% · uso das 7h às 18h
              </p>

              <a href="#valores">
                Conheça as condições
                <ArrowRight size={18} />
              </a>
            </div>
          </article>

          {/* LANCHAS */}
          <article className={styles.futureVehicle}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '180px',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#f3f6fa',
                marginBottom: '18px',
              }}
            >
              <Image
                src="/lancha-quotta.jpg"
                alt="Imagem ilustrativa de lancha esportiva"
                fill
                sizes="(max-width: 850px) 100vw, 33vw"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center',
                }}
              />
            </div>

            <span className={styles.coming}>
              EM BREVE
            </span>

            <h3>Lanchas</h3>

            <p>
              Novas experiências na água para compartilhar
              com a família e amigos.
            </p>
          </article>

          {/* CARROS */}
          <article className={styles.futureVehicle}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '180px',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#f3f6fa',
                marginBottom: '18px',
              }}
            >
              <Image
                src="/lamborghini-quotta.jpg"
                alt="Imagem ilustrativa de Lamborghini amarela"
                fill
                sizes="(max-width: 850px) 100vw, 33vw"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center',
                }}
              />
            </div>

            <span className={styles.coming}>
              EM BREVE
            </span>

            <h3>Carros</h3>

            <p>
              Mobilidade e conforto em novos bens
              compartilhados do clube.
            </p>
          </article>

        </div>
      </section>

      {/* VANTAGENS */}
      <section
        className={styles.benefits}
        aria-label="Vantagens do clube"
      >
        <div>
          <CalendarDays />
          <span>Reserva simples<br />pelo aplicativo</span>
        </div>

        <div>
          <Users />
          <span>Uso organizado<br />entre cotistas</span>
        </div>

        <div>
          <ShieldCheck />
          <span>Rodízio justo<br />nas datas disputadas</span>
        </div>

        <div>
          <Fuel />
          <span>Combustível por<br />conta do usuário</span>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className={styles.section}>
        <div className={styles.centerTitle}>
          <span className={styles.kicker}>
            SIMPLES DE ENTENDER
          </span>

          <h2>Como funciona o QUOTTA Club?</h2>

          <p>
            Quatro passos para aproveitar seu bem compartilhado.
          </p>
        </div>

        <div className={styles.steps}>
          <article>
            <b>1</b>
            <Users />
            <h3>Adquira sua cota</h3>
            <p>Você participa de um bem dividido em cotas iguais.</p>
          </article>

          <article>
            <b>2</b>
            <CalendarDays />
            <h3>Escolha o dia</h3>
            <p>Acesse o aplicativo e solicite seu horário de uso.</p>
          </article>

          <article>
            <b>3</b>
            <CheckCircle2 />
            <h3>Aguarde a confirmação</h3>
            <p>
              Confira se a reserva foi aprovada.
              Datas disputadas seguem o rodízio.
            </p>
          </article>

          <article>
            <b>4</b>
            <Waves />
            <h3>Aproveite!</h3>
            <p>
              Use no horário combinado e cuide bem do veículo.
            </p>
          </article>
        </div>
      </section>

      {/* VALORES */}
      <section id="valores" className={styles.pricingSection}>
        <div className={styles.pricingText}>
          <span className={styles.kicker}>
            SEJA UM COTISTA
          </span>

          <h2>
            Seu Sea-Doo, com investimento compartilhado.
          </h2>

          <p>
            Uma forma organizada de ter acesso à diversão na água,
            sem precisar adquirir sozinho toda a embarcação.
          </p>

          <ul>
            <li>
              <CheckCircle2 />
              1 de 8 cotas iguais: participação de 12,5%
            </li>

            <li>
              <CheckCircle2 />
              Reservas das 7h às 18h, conforme disponibilidade
            </li>

            <li>
              <CheckCircle2 />
              Rodízio para datas disputadas
            </li>

            <li>
              <CheckCircle2 />
              Combustível pago por quem utiliza
            </li>
          </ul>
        </div>

        <div className={styles.priceCard}>
          <span>VALOR DE CADA COTA</span>

          <strong>R$ 28.900</strong>

          <div className={styles.priceDivider} />

          <p>
            <b>Entrada de 50%</b>
            <strong>R$ 14.450</strong>
          </p>

          <p>
            <b>Saldo no cartão</b>
            <strong>Até 12x de R$ 1.204,17*</strong>
          </p>

          <p>
            <b>Mensalidade</b>
            <strong>R$ 450/mês</strong>
          </p>

          <a
            href="mailto:?subject=Interesse%20em%20uma%20cota%20QUOTTA%20Club&body=Ol%C3%A1%2C%20gostaria%20de%20receber%20mais%20informa%C3%A7%C3%B5es%20sobre%20uma%20cota%20do%20Sea-Doo%20Wake%20Pro%202026."
            className={styles.goldButton}
          >
            Solicitar informações
            <ArrowRight size={19} />
          </a>

          <small>
            *Parcelamento ilustrativo sem juros ou taxas:
            11 parcelas de R$ 1.204,17 e última de R$ 1.204,13,
            totalizando R$ 14.450,00.
            Taxas do cartão, se houver, e condições finais devem
            ser confirmadas com o clube.
            Aquisição sujeita à disponibilidade.
          </small>
        </div>
      </section>

      {/* ÁREA DO COTISTA */}
      <section className={styles.help}>
        <LifeBuoy size={32} />

        <div>
          <h2>Já é cotista?</h2>
          <p>
            Entre na sua área para acompanhar mensalidades
            e solicitar reservas.
          </p>
        </div>

        <Link href="/login" className={styles.goldButton}>
          Acessar minha conta
          <ArrowRight size={20} />
        </Link>
      </section>

      {/* RODAPÉ */}
      <footer className={styles.footer}>
        <Brand />

        <span>
          QUOTTA Club · Guarapari — Espírito Santo
        </span>

        <span>
          Mais liberdade para viver bons momentos.
        </span>
      </footer>

    </main>
  );
}
