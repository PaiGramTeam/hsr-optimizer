import {
  Flex,
  Table,
} from 'antd'
import i18next from 'i18next'
import {
  Sets,
  setToId,
} from 'lib/constants/constants'
import { BUFF_TYPE } from 'lib/optimization/buffSource'
import { Buff } from 'lib/optimization/computedStatsArray'
import {
  ComputedStatsObject,
  StatsConfig,
} from 'lib/optimization/config/computedStatsConfig'
import { generateContext } from 'lib/optimization/context/calculateContext'
import { formatOptimizerDisplayData } from 'lib/optimization/optimizer'
import { Assets } from 'lib/rendering/assets'
import {
  originalScoringParams,
  SimulationScore,
} from 'lib/scoring/simScoringUtils'
import { aggregateCombatBuffs } from 'lib/simulations/combatBuffsAnalysis'
import { runStatSimulations } from 'lib/simulations/statSimulation'
import { cardShadow } from 'lib/tabs/tabOptimizer/optimizerForm/layout/FormCard'
import { currentLocale } from 'lib/utils/i18nUtils'
import { TsUtils } from 'lib/utils/TsUtils'
import React, { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

type BuffsAnalysisProps = {
  result?: SimulationScore,
  buffGroups?: Record<BUFF_TYPE, Record<string, Buff[]>>,
  singleColumn?: boolean,
  size?: BuffDisplaySize,
}

export function BuffsAnalysisDisplay(props: BuffsAnalysisProps) {
  const buffGroups = props.buffGroups ?? rerunSim(props.result)

  if (!buffGroups) {
    return <></>
  }

  const buffsDisplayLeft: ReactElement[] = []
  const buffsDisplayRight: ReactElement[] = []
  let groupKey = 0

  const size = props.size ?? BuffDisplaySize.SMALL

  for (const [id, buffs] of Object.entries(buffGroups.PRIMARY)) {
    buffsDisplayLeft.push(<BuffGroup id={id} buffs={buffs} buffType={BUFF_TYPE.PRIMARY} key={groupKey++} size={size} />)
  }

  for (const [id, buffs] of Object.entries(buffGroups.SETS)) {
    buffsDisplayLeft.push(<BuffGroup id={id} buffs={buffs} buffType={BUFF_TYPE.SETS} key={groupKey++} size={size} />)
  }

  for (const [id, buffs] of Object.entries(buffGroups.CHARACTER)) {
    buffsDisplayRight.push(<BuffGroup id={id} buffs={buffs} buffType={BUFF_TYPE.CHARACTER} key={groupKey++} size={size} />)
  }

  for (const [id, buffs] of Object.entries(buffGroups.LIGHTCONE)) {
    buffsDisplayRight.push(<BuffGroup id={id} buffs={buffs} buffType={BUFF_TYPE.LIGHTCONE} key={groupKey++} size={size} />)
  }

  if (props.singleColumn) {
    return (
      <Flex gap={20} vertical>
        {buffsDisplayLeft}
        {buffsDisplayRight}
      </Flex>
    )
  }

  return (
    <Flex justify='space-between' style={{ width: '100%' }}>
      <Flex gap={20} vertical>
        {buffsDisplayLeft}
      </Flex>
      <Flex gap={20} vertical>
        {buffsDisplayRight}
      </Flex>
    </Flex>
  )
}

function rerunSim(result?: SimulationScore) {
  if (!result) return null
  result.simulationForm.trace = true
  const context = generateContext(result.simulationForm)
  const rerun = runStatSimulations([result.originalSim], result.simulationForm, context, originalScoringParams)[0]
  const optimizerDisplayData = formatOptimizerDisplayData(rerun.x)
  const x = optimizerDisplayData.tracedX!
  return aggregateCombatBuffs(x, result.simulationForm)
}

function BuffGroup(props: { id: string, buffs: Buff[], buffType: BUFF_TYPE, size: BuffDisplaySize }) {
  const { i18n } = useTranslation() // needed to trigger re-render on language change
  const { id, buffs, buffType, size } = props

  let src
  if (buffType == BUFF_TYPE.PRIMARY) src = Assets.getCharacterAvatarById(id)
  else if (buffType == BUFF_TYPE.CHARACTER) src = Assets.getCharacterAvatarById(id)
  else if (buffType == BUFF_TYPE.LIGHTCONE) src = Assets.getLightConeIconById(id)
  else if (buffType == BUFF_TYPE.SETS) src = Assets.getSetImage(Sets[id as keyof typeof Sets])
  else src = Assets.getBlank()

  return (
    <Flex align='center' gap={5}>
      <img src={src} style={{ width: 64, height: 64 }} />

      <BuffTable buffs={buffs} size={size} />
    </Flex>
  )
}

type BuffTableItem = {
  key: number,
  value: string,
  statLabel: string,
  sourceLabel: string,
}

function BuffTable(props: { buffs: Buff[], size: BuffDisplaySize }) {
  const { buffs } = props
  const { t: tOptimizerTab } = useTranslation('optimizerTab', { keyPrefix: 'ExpandedDataPanel.BuffsAnalysisDisplay' })
  const { t: tGameData } = useTranslation('gameData')
  const size = props.size ?? BuffDisplaySize.SMALL

  const columns = [
    {
      dataIndex: 'value',
      key: 'value',
      width: 70,
      minWidth: 70,
      render: (value: string) => <span style={{ textWrap: 'nowrap' }}>{value}</span>,
    },
    {
      dataIndex: 'stat',
      key: 'stat',
      render: (_: string, record: BuffTableItem) => (
        <Flex justify='space-between'>
          <span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', textWrap: 'nowrap', marginRight: 10, minWidth: 130 }}>
            {record.statLabel}
          </span>
          <span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', textWrap: 'nowrap', textAlign: 'end' }}>
            {record.sourceLabel}
          </span>
        </Flex>
      ),
    },
  ]

  const data = buffs.map((buff, i) => {
    const stat = buff.stat as keyof ComputedStatsObject
    const percent = !StatsConfig[stat].flat
    const bool = StatsConfig[stat].bool
    const statLabel = translatedLabel(stat, buff.memo)

    let sourceLabel: string
    switch (buff.source.buffType) {
      case BUFF_TYPE.CHARACTER:
        sourceLabel = tOptimizerTab(`Sources.${buff.source.ability}`)
        break
      case BUFF_TYPE.LIGHTCONE:
        sourceLabel = tGameData(`Lightcones.${buff.source.id}.Name`)
        break
      case BUFF_TYPE.SETS:
        sourceLabel = tGameData(`RelicSets.${setToId[Sets[buff.source.id]]}.Name`)
        break
      default:
        sourceLabel = buff.source.label
    }
    let value
    if (bool) {
      value = tOptimizerTab(`Values.${buff.value ? 'BoolTrue' : 'BoolFalse'}`)
    } else if (percent) {
      value = TsUtils.precisionRound(buff.value * 100, 2).toLocaleString(currentLocale()) + ' %'
    } else {
      value = TsUtils.precisionRound(buff.value, 0).toLocaleString(currentLocale())
    }

    return {
      key: i,
      value: value,
      statLabel: statLabel,
      sourceLabel: sourceLabel,
    } as BuffTableItem
  })

  return (
    <Table<BuffTableItem>
      columns={columns}
      dataSource={data}
      pagination={false}
      size='small'
      className='buff-table remove-table-bottom-border'
      rowClassName='buff-row'
      tableLayout='fixed'
      style={{
        width: size,
        border: '1px solid #354b7d',
        boxShadow: cardShadow,
        borderRadius: 5,
        overflow: 'hidden',
        fontSize: 14,
      }}
    />
  )
}

export enum BuffDisplaySize {
  SMALL = 390,
  LARGE = 450,
}

function translatedLabel(stat: keyof ComputedStatsObject, isMemo = false) {
  const label = StatsConfig[stat]?.label
  if (!label) return stat
  if (label.composite) {
    // type conformity is enforced by the helper functions in src/lib/optimization/config/setsConfig
    // @ts-ignore
    const prefix: string = i18next.t(`${label.prefix.ns}:${label.prefix.key}`, label.prefix.args)
    // @ts-ignore
    const suffix: string = i18next.t(`${label.suffix.ns}:${label.suffix.key}`, label.suffix.args)
    const finalLabel = i18next.t('optimizerTab:ExpandedDataPanel.BuffsAnalysisDisplay.Stats.CompositeLabels.Label', { prefix, suffix }) as string
    return isMemo ? i18next.t('MemospriteLabel', { label: finalLabel }) : finalLabel
  } else {
    // @ts-ignore
    const finalLabel: string = i18next.t(`${label.ns}:${label.key}`, label.args)
    return isMemo ? i18next.t('MemospriteLabel', { label: finalLabel }) : finalLabel
  }
}
