/**
 * Ícones de linha da biblioteca Lucide (traço 1.75), por nome em kebab-case,
 * como vêm da planilha (coluna `icone` das categorias/tipos).
 * Só os ícones listados aqui entram no pacote (tree-shaking).
 */
import type { LucideIcon, LucideProps } from 'lucide-react'
import {
  Wallet, House, ShoppingCart, Target, Church, HandHeart, HandCoins, KeyRound, Building2, Landmark, Zap, Droplet, Flame,
  Wifi, Smartphone, HeartPulse, GraduationCap, BookOpen, Car, ShieldCheck, Bus, Tv, Apple, Croissant, Beef, Bike, Utensils,
  Fuel, ParkingMeter, Wrench, Pill, Stethoscope, Scissors, Hammer, Sofa, SprayCan, Ticket, Plane, Palette, Shirt, Gift,
  PawPrint, TriangleAlert, Briefcase, Banknote, PiggyBank, CircleDollarSign, LayoutGrid, CirclePlus, CalendarClock,
  MessageSquare, Settings, Upload, Camera, FileText, Keyboard, Mic, Check, Send, Paperclip, Bell, TrendingUp, Calendar,
  Repeat, Receipt, Users, CreditCard, ChevronLeft, ChevronRight, ChevronDown, X, Search, Copy, Share2, LogOut, Sun, Moon,
  Type, Lock, QrCode, Download, Trash2, Pencil, Vote, ThumbsUp, ThumbsDown, MinusCircle, Clock, AlertCircle, Info,
  CheckCircle2, Undo2, Image, Shield, Crown, Anchor, Leaf, Wheat, Cross, UserRound, Mail, ExternalLink, Database,
  RefreshCw, Eye, EyeOff, Plus, Minus, ArrowUp, ArrowDown, Sparkles, Inbox, ListChecks, Scale, Coins, FileSpreadsheet,
  Printer, Filter, MoreHorizontal, Menu, Lightbulb, BadgeCheck, Hourglass, CircleCheck, CircleX, CircleAlert, BookMarked,
  Goal, Siren, Baby, HandHelping, MessageCircle, UserPlus, Inbox as CaixaEntrada,
} from 'lucide-react'

export const ICONES: Record<string, LucideIcon> = {
  // cardápio
  wallet: Wallet, house: House, 'shopping-cart': ShoppingCart, target: Target, church: Church, 'hand-heart': HandHeart,
  'hand-coins': HandCoins, 'key-round': KeyRound, 'building-2': Building2, landmark: Landmark, zap: Zap, droplet: Droplet,
  flame: Flame, wifi: Wifi, smartphone: Smartphone, 'heart-pulse': HeartPulse, 'graduation-cap': GraduationCap,
  'book-open': BookOpen, car: Car, 'shield-check': ShieldCheck, bus: Bus, tv: Tv, apple: Apple, croissant: Croissant,
  beef: Beef, bike: Bike, utensils: Utensils, fuel: Fuel, 'parking-meter': ParkingMeter, wrench: Wrench, pill: Pill,
  stethoscope: Stethoscope, scissors: Scissors, hammer: Hammer, sofa: Sofa, 'spray-can': SprayCan, ticket: Ticket,
  plane: Plane, palette: Palette, shirt: Shirt, gift: Gift, 'paw-print': PawPrint, 'triangle-alert': TriangleAlert,
  briefcase: Briefcase, banknote: Banknote, 'piggy-bank': PiggyBank, 'circle-dollar-sign': CircleDollarSign,
  // interface
  'layout-grid': LayoutGrid, 'circle-plus': CirclePlus, 'calendar-clock': CalendarClock, 'message-square': MessageSquare,
  settings: Settings, upload: Upload, camera: Camera, 'file-text': FileText, keyboard: Keyboard, mic: Mic, check: Check,
  send: Send, paperclip: Paperclip, bell: Bell, 'trending-up': TrendingUp, calendar: Calendar, repeat: Repeat,
  receipt: Receipt, users: Users, 'credit-card': CreditCard, 'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
  'chevron-down': ChevronDown, x: X, search: Search, copy: Copy, 'share-2': Share2, 'log-out': LogOut, sun: Sun, moon: Moon,
  type: Type, lock: Lock, 'qr-code': QrCode, download: Download, 'trash-2': Trash2, pencil: Pencil, vote: Vote,
  'thumbs-up': ThumbsUp, 'thumbs-down': ThumbsDown, 'minus-circle': MinusCircle, clock: Clock, 'alert-circle': AlertCircle,
  info: Info, 'check-circle-2': CheckCircle2, 'undo-2': Undo2, image: Image, shield: Shield, crown: Crown, anchor: Anchor,
  leaf: Leaf, wheat: Wheat, cross: Cross, 'user-round': UserRound, mail: Mail, 'external-link': ExternalLink,
  database: Database, 'refresh-cw': RefreshCw, eye: Eye, 'eye-off': EyeOff, plus: Plus, minus: Minus, 'arrow-up': ArrowUp,
  'arrow-down': ArrowDown, sparkles: Sparkles, inbox: Inbox, 'list-checks': ListChecks, scale: Scale, coins: Coins,
  'file-spreadsheet': FileSpreadsheet, printer: Printer, filter: Filter, 'more-horizontal': MoreHorizontal, menu: Menu,
  lightbulb: Lightbulb, 'badge-check': BadgeCheck, hourglass: Hourglass, 'circle-check': CircleCheck, 'circle-x': CircleX,
  'circle-alert': CircleAlert, 'book-marked': BookMarked, goal: Goal, siren: Siren, baby: Baby, 'hand-helping': HandHelping,
  'message-circle': MessageCircle, 'user-plus': UserPlus,
  'caixa-entrada': CaixaEntrada,
}

/** Nomes disponíveis para o seletor de ícone em Configurações › Cardápio. */
export const NOMES_ICONES_CARDAPIO = [
  'wallet', 'house', 'shopping-cart', 'target', 'church', 'hand-heart', 'hand-coins', 'key-round', 'building-2', 'landmark',
  'zap', 'droplet', 'flame', 'wifi', 'smartphone', 'heart-pulse', 'graduation-cap', 'book-open', 'car', 'shield-check', 'bus',
  'tv', 'apple', 'croissant', 'beef', 'bike', 'utensils', 'fuel', 'parking-meter', 'wrench', 'pill', 'stethoscope', 'scissors',
  'hammer', 'sofa', 'spray-can', 'ticket', 'plane', 'palette', 'shirt', 'gift', 'paw-print', 'triangle-alert', 'briefcase',
  'banknote', 'piggy-bank', 'circle-dollar-sign', 'coins', 'receipt', 'credit-card', 'baby', 'leaf', 'wheat', 'anchor', 'crown',
  'cross', 'shield', 'sparkles', 'lightbulb', 'goal', 'repeat', 'calendar', 'users', 'image', 'mail', 'scale',
]

export interface IconeProps extends Omit<LucideProps, 'ref'> {
  nome: string
  /** Tamanho em px (padrão 18, como `svg.i` da referência). */
  tamanho?: number
}

/** `<Icone nome="shopping-cart" />` — classe `i` (18 px, traço 1.75). Nome desconhecido cai em um círculo. */
export function Icone({ nome, tamanho = 18, className = '', ...resto }: IconeProps) {
  const Comp = ICONES[nome] ?? CircleAlert
  return <Comp aria-hidden="true" className={`i ${className}`} width={tamanho} height={tamanho} strokeWidth={1.75} {...resto} />
}

/** Cor da paleta → variável CSS. */
export function corVar(cor: string | undefined): string {
  const nomes = ['indigo', 'sel', 'magenta', 'gold', 'orange', 'green', 'red', 'lilac', 'rose', 'slate']
  if (!cor) return 'var(--indigo)'
  if (nomes.includes(cor)) return `var(--${cor})`
  return cor // já é uma cor CSS (#hex)
}

/** Cor da paleta → hexadecimal (para SVG/Recharts). */
export const HEX: Record<string, string> = {
  indigo: '#5B5BE0', sel: '#7776E6', magenta: '#BD55C7', gold: '#F2C552', orange: '#E0852F', green: '#4CB963',
  red: '#E5535B', lilac: '#9A99F0', rose: '#E58FD9', slate: '#6B6E80',
}
export function corHex(cor: string | undefined): string {
  if (!cor) return HEX.indigo
  return HEX[cor] ?? cor
}
