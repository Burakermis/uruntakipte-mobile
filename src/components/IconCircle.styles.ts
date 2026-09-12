import { StyleSheet } from 'react-native';

// backgroundColor gerçekten dinamik, çağrı yerine özgü bir prop (temadan
// gelen sabit bir token değil) — bu yüzden burada değil, IconCircle.tsx'te
// satır-içi olarak eklenir. Burası sadece boyuta bağlı geometriyi tutar.
export const makeStyles = (size: number) =>
  StyleSheet.create({
    circle: {
      width: size,
      height: size,
      borderRadius: size / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
