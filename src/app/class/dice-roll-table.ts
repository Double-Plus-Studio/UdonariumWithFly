import { SyncObject, SyncVar } from './core/synchronize-object/decorator';
import { ObjectNode } from './core/synchronize-object/object-node';
import { StringUtil } from './core/system/util/string-util';

export interface DiceRollTableRow {
  range: { start: number | null, end: number | null },
  result: string
}
@SyncObject('dice-roll-table')
export class DiceRollTable extends ObjectNode {
  @SyncVar() name: string = '';
  @SyncVar() command: string = '';
  @SyncVar() dice: string = '';

  parseText(): DiceRollTableRow[] {
    if (!this.value) return [];
    return (<string>this.value).split(/[\r\n]+/).map(row => {
      row = row.trim();
      let match: RegExpMatchArray | null = null;
      match = row.match(/([\-－‐]?[\d０-９]+)[\s　]*[\-―－~～][\s　]*([\-－‐]?[\d０-９]+)[\s　]*[:：](.+)/);
      if (match) {
        const start = +StringUtil.toHalfWidth(match[1].replace(/[\-－‐]/, '-'));
        const end = +StringUtil.toHalfWidth(match[2].replace(/[\-－‐]/, '-'));
        if (start <= end) {
          return {range: { start: start, end: end }, result: match[3]};
        } else {
          return {range: { start: end, end: start }, result: match[3]};
        }
      }
      match = row.match(/([\-－‐]?[\d０-９]+)[\s　]*[\-―－~～][\s　]*[\*＊][\s　]*[:：](.+)/);
      if (match) {
        const num = +StringUtil.toHalfWidth(match[1].replace(/[\-－‐]/, '-'));
        return {range: { start: num, end: null }, result: match[2]};
      }
      match = row.match(/[\*＊][\s　]*[\-―－~～][\s　]*([\-－‐]?[\d０-９]+)[\s　]*[:：](.+)/);
      if (match) {
        const num = +StringUtil.toHalfWidth(match[1].replace(/[\-－‐]/, '-'));
        return {range: { start: null, end: num }, result: match[2]};
      }
      match = row.match(/([\-－‐]?[\d０-９]+)[\s　]*[:：](.+)/);
      if (match) {
        const num = +StringUtil.toHalfWidth(match[1].replace(/[\-－‐]/, '-'));
        return {range: { start: num, end: num }, result: match[2]};
      }
      match = row.match(/[\*＊][\s　]*[\-―－~～][\*＊][\s　]*[:：](.+)/) || row.match(/[\*＊][\s　]*[:：](.+)/);
      if (match) {
        return {range: { start: null, end: null }, result: match[1]};
      } else {
        return null as any;
      }
    }).filter((elm): elm is DiceRollTableRow => elm !== null);
  }
}