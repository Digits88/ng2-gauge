import {
  Component, Input, ViewChild, OnInit,
  AfterViewInit, Renderer, ElementRef, ViewEncapsulation
} from '@angular/core';

import { Sector, Line, Cartesian, RenderSector, Value, Separator, GaugeProps } from './shared/gauge.interface';
import { Config, GaugeConfig } from './shared/config';
import { validate } from './shared/validators';

@Component({
  selector: 'ng-gauge',
  template: `
    <section class="angular-gauge" [class.light]="lightTheme">
      <svg class="info" [attr.viewBox]="viewBox" xmlns="http://www.w3.org/2000/svg">
        <circle *ngIf="light"
          class="red-light"
          [class.on]="input >= light"
          [attr.cx]="center"
          [attr.cy]="Config.LIGHT_Y"
          [attr.r]="Config.LIGHT_RADIUS">
        </circle>
        <text *ngIf="max > Config.MAX_PURE_SCALE_VAL"
          class="factor"
          [attr.x]="center"
          [attr.y]="Config.S_FAC_Y">
          x{{scaleFactor}} {{unit}}
        </text>
        <text *ngIf="showDigital"
          class="digital"
          [attr.x]="center"
          [attr.y]="Config.DIGITAL_Y">
          {{input}}
        </text>
        <text class="unit" [attr.x]="center" [attr.y]="Config.UNIT_Y">{{unit}}</text>
      </svg>
      <svg #gauge [attr.viewBox]="viewBox" xmlns="http://www.w3.org/2000/svg">
        <path class="main-arc" [attr.d]="arc" [attr.stroke-width]="Config.ARC_STROKE" fill="none" />
        <path *ngFor="let arc of sectorArcs"
          [attr.d]="arc.path"
          [attr.stroke]="arc.color"
          [attr.stroke-width]="Config.ARC_STROKE"
          fill="none" />
        <line *ngFor="let line of scaleLines"
          [attr.stroke-width]="Config.SL_WIDTH"
          [attr.stroke]="line.color || (!lightTheme ? '#333' : '#fff')"
          [attr.x1]="line.from.x"
          [attr.y1]="line.from.y"
          [attr.x2]="line.to.x"
          [attr.y2]="line.to.y" />
        <text *ngFor="let val of scaleValues"
          class="text-val"
          dominant-baseline="central"
          [attr.x]="val.coor.x"
          [attr.y]="val.coor.y"
          [attr.transform]="'rotate(' + gaugeRotationAngle + ', ' + val.coor.x + ', ' + val.coor.y + ')'">
          {{val.text}}
        </text>
        <rect #arrow
          class="arrow"
          [attr.x]="center - Config.ARROW_WIDTH / 2"
          [attr.y]="Config.ARROW_Y"
          [attr.height]="center - Config.ARROW_Y"
          [attr.width]="Config.ARROW_WIDTH"
          [attr.rx]="Config.ARROW_WIDTH / 2"
          [attr.ry]="Config.ARROW_WIDTH / 2">
        </rect>
        <circle class="arrow-pin" [attr.cx]="center" [attr.cy]="center" [attr.r]="Config.ARROW_PIN_RAD" />
      </svg>
    </section>
  `,
  styles: [`
    @font-face {
      font-family: 'Orbitron';
      font-style: normal;
      font-weight: 700;
      src: local('Orbitron Bold'), local('Orbitron-Bold'), url(https://fonts.gstatic.com/s/orbitron/v8/Y82YH_MJJWnsH2yUA5AuYY4P5ICox8Kq3LLUNMylGO4.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2212, U+2215;
    }

    .angular-gauge {
      position: relative;
      width: 400px;
    }

    .angular-gauge svg.info {
      position: absolute;
      top: 0;
      left: 0;
    }

    .angular-gauge rect.arrow {
      transform-origin: 50% 100%;
      fill: orange;
    }

    .angular-gauge text {
      font-family: 'Orbitron', sans-serif;
      font-weight: bold;
      text-anchor: middle;
      fill: #333;
    }

    .angular-gauge.light text {
      fill: #fff;
    }

    .angular-gauge text.text-val {
      font-size: 12px;
    }

    .angular-gauge circle.arrow-pin {
      fill: #333;
    }

    .angular-gauge path.main-arc {
      stroke: #333;
    }

    .angular-gauge.light path.main-arc {
      stroke: #fff;
    }

    .angular-gauge text.factor {
      font-size: 7px;
    }

    .angular-gauge text.digital {
      font-size: 16px;
    }

    .angular-gauge text.unit {
      font-size: 10px;
    }

    .angular-gauge circle.red-light {
      fill: #ff4f4f;
      opacity: 0.1;
    }

    .angular-gauge circle.red-light.on {
      opacity: 1;
    }

  `],
  encapsulation: ViewEncapsulation.None
})
export class GaugeComponent implements OnInit, AfterViewInit, GaugeProps {
  @ViewChild('gauge') gauge: ElementRef;
  @ViewChild('arrow') arrow: ElementRef;

  @Input() start: number = Config.DEF_START;
  @Input() end: number = Config.DEF_END;
  @Input() max: number;
  @Input() sectors: Sector[];
  @Input() unit: string;
  @Input() showDigital: boolean;
  @Input() light: number;
  @Input() lightTheme: boolean;
  @Input() factor: number;
  @Input() config: GaugeConfig;

  Config: GaugeConfig = Config;
  viewBox: string;
  scaleLines: Line[];
  scaleValues: Value[];
  sectorArcs: RenderSector[];

  radius: number;
  center: number;
  scaleFactor: number;
  private _end: number;
  private _input: number;

  constructor(private _renderer: Renderer) {
    this.scaleLines = [];
    this.scaleValues = [];
  }

  @Input()
  set input(val: number) {
    this._input = val;
    this._updateArrowPos(val);
  }

  get input(): number {
    return this._input;
  }

  get arc(): string {
    return this._arc(0, this._end);
  }

  get gaugeRotationAngle(): number {
    return this._end - this.end;
  }

  ngOnInit(): void {
    validate(this);

    const width = Config.WIDTH + Config.ARC_STROKE;

    this.viewBox = `0 0 ${width} ${width}`;
    this.radius = Config.WIDTH / 2;
    this.center = width / 2;
    this._end = this.end;

    if (this.start > this.end) {
      this._end += (360 - this.start);
    } else {
      this._end -= this.start;
    }

    this._updateArrowPos(this._input);
    this._calculateSectors();
    this.scaleFactor = this.factor || this._determineScaleFactor();
    this._createScale();
  }

  ngAfterViewInit(): void {
    this._rotateGauge();
  }

  /**
   * Calculate arc.
   */
  private _arc(start: number, end: number): string {
    const largeArc = end - start <= 180 ? 0 : 1;
    const startCoor = this._getAngleCoor(start);
    const endCoor = this._getAngleCoor(end);

    return `M ${endCoor.x} ${endCoor.y} A ${this.radius} ${this.radius} 0 ${largeArc} 0 ${startCoor.x} ${startCoor.y}`;
  }

  /**
   * Get angle coordinates (Cartesian coordinates).
   */
  private _getAngleCoor(degrees: number): Cartesian {
    const rads = (degrees - 90) * Math.PI / 180;
    return {
      x: (this.radius * Math.cos(rads)) + this.center,
      y: (this.radius * Math.sin(rads)) + this.center
    };
  }

  /**
   * Calculate/translate the user-defined sectors to arcs.
   */
  private _calculateSectors(): void {
    if (!this.sectors) {
      return;
    }

    this.sectors = this.sectors.map((s: Sector) => {
      const ratio = this._end / this.max;
      s.from *= ratio;
      s.to *= ratio;
      return s;
    });

    this.sectorArcs = this.sectors.map((s: Sector) => {
      return {
        path: this._arc(s.from, s.to),
        color: s.color
      };
    });
  }

  /**
   * Update the position of the arrow based on the input.
   */
  private _updateArrowPos(input: number): void {
    const pos = (this._end / this.max) * input;
    this._renderer.setElementStyle(this.arrow.nativeElement, 'transform', `rotate(${pos}deg)`);
  }

  /**
   * Rotate the gauge based on the start property. The CSS rotation, saves additional calculations with SVG.
   */
  private _rotateGauge(): void {
    const angle = 360 - this.start;
    this._renderer.setElementStyle(this.gauge.nativeElement, 'transform', `rotate(-${angle}deg)`);
  }

  /**
   * Determine the scale factor (10^n number; i.e. if max = 9000 then scale_factor = 1000)
   */
  private _determineScaleFactor(factor = 10): number {
    // Keep smaller factor until 3X
    if (this.max / factor > 30) {
      return this._determineScaleFactor(factor * 10);
    }
    return factor;
  }

  /**
   * Determine the line frequency which represents after what angle we should put a line.
   */
  private _determineLineFrequency(): number {
    const separators = this.max / this.scaleFactor;
    const separateAtAngle = this._end / separators;
    let lineFrequency: number;

    // If separateAtAngle is not an integer, use its value as the line frequency.
    if (separateAtAngle % 1 !== 0) {
      lineFrequency = separateAtAngle;
    } else {
      lineFrequency = Config.INIT_LINE_FREQ * 2;
      for (lineFrequency; lineFrequency <= separateAtAngle; lineFrequency++) {
        if (separateAtAngle % lineFrequency === 0) {
          break;
        }
      }
    }

    return lineFrequency;
  }

  /**
   * Checks whether the line (based on index) is big or small separator.
   */
  private _isSeparatorReached(idx: number, lineFrequency: number): Separator {
    const separators = this.max / this.scaleFactor;
    const totalSeparators = this._end / lineFrequency;
    const separateAtIdx = totalSeparators / separators;

    if (idx % separateAtIdx === 0) {
      return Separator.Big;
    } else if (idx % (separateAtIdx / 2) === 0) {
      return Separator.Small;
    }
    return Separator.NA;
  };

  /**
   * Creates the scale.
   */
  private _createScale(): void {
    const accumWith = this._determineLineFrequency() / 2;
    const isAboveSuitableFactor = this.max / this.scaleFactor > 10;
    let placedVals = 0;

    for (let alpha = 0, i = 0; alpha >= (-1) * this._end; alpha -= accumWith, i++) {
      let lineHeight = Config.SL_NORM;
      const sepReached = this._isSeparatorReached(i, accumWith);

      // Set the line height based on its type
      switch (sepReached) {
        case Separator.Big:
          placedVals++;
          lineHeight = Config.SL_SEP;
          break;
        case Separator.Small:
          lineHeight = Config.SL_MID_SEP;
          break;
      }

      // Draw the line
      const higherEnd = this.center - Config.ARC_STROKE - 2;
      const lowerEnd = higherEnd - lineHeight;

      const alphaRad = Math.PI / 180 * (alpha + 180);
      const sin = Math.sin(alphaRad);
      const cos = Math.cos(alphaRad);
      const color = this._getScaleLineColor(alpha);

      this._addScaleLine(sin, cos, higherEnd, lowerEnd, color);

      // Put a scale value
      if (sepReached === Separator.Big) {
        const isValuePosEven = placedVals % 2 === 0;
        const isLast = alpha <= (-1) * this._end;

        if (!(isAboveSuitableFactor && isValuePosEven && !isLast)) {
          this._addScaleValue(sin, cos, lowerEnd, alpha);
        }
      }
    }
  }

  /**
   * Get the scale line color from the user-provided sectors definitions.
   */
  private _getScaleLineColor(alpha: number): string {
    alpha *= (-1);
    let color: string = '';

    if (this.sectors) {
      this.sectors.forEach((s: Sector) => {
        if (s.from <= alpha && alpha <= s.to) {
          color = s.color;
        }
      });
    }

    return color;
  }

  /**
   * Add a scale line to the list that will be later rendered.
   */
  private _addScaleLine(sin: number, cos: number, higherEnd: number, lowerEnd: number, color: string): void {
    this.scaleLines.push({
      from: {
        x: sin * higherEnd + this.center,
        y: cos * higherEnd + this.center
      },
      to: {
        x: sin * lowerEnd + this.center,
        y: cos * lowerEnd + this.center
      },
      color
    });
  }

  /**
   * Add a scale value.
   */
  private _addScaleValue(sin: number, cos: number, lowerEnd: number, alpha: number): void {
    let val = Math.round(alpha * (this.max / this._end)) * (-1);
    let posMargin = Config.TXT_MARGIN * 2;

    // Use the multiplier instead of the real value, if above MAX_PURE_SCALE_VAL (i.e. 1000)
    if (this.max > Config.MAX_PURE_SCALE_VAL) {
      val /= this.scaleFactor;
      val = Math.round(val * 100) / 100;
      posMargin /= 2;
    }

    this.scaleValues.push({
      text: val.toString(),
      coor: {
        x: sin * (lowerEnd - posMargin) + this.center,
        y: cos * (lowerEnd - posMargin) + this.center
      }
    });
  }
}
