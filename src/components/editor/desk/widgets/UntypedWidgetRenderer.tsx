import styles from '../../WritingDesk.module.css';

export function UntypedWidgetRenderer() {
  return <div className={styles.untypedWidget}><span className={styles.untypedHint}>Use "Choose" in the title bar to set widget type</span></div>;
}
